package handler

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/middleware"
	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

// vendorRequest is used to decode the vendor form payload.
// PaymentTerms is json.Number so it accepts both JSON numbers and strings.
type vendorRequest struct {
	Name          string          `json:"name"`
	ContactPerson *string         `json:"contactPerson"`
	Phone         *string         `json:"phone"`
	Email         *string         `json:"email"`
	Address       *string         `json:"address"`
	City          *string         `json:"city"`
	State         *string         `json:"state"`
	Pincode       *string         `json:"pincode"`
	GSTIN         *string         `json:"gstin"`
	PAN           *string         `json:"pan"`
	PaymentTerms  json.Number `json:"paymentTerms"`
	Notes         *string     `json:"notes"`
}

func (vr vendorRequest) toSupplier() models.Supplier {
	s := models.Supplier{
		Name:          vr.Name,
		ContactPerson: vr.ContactPerson,
		Phone:         vr.Phone,
		Email:         vr.Email,
		Address:       vr.Address,
		City:          vr.City,
		State:         vr.State,
		Pincode:       vr.Pincode,
		GSTIN:         vr.GSTIN,
		PAN:           vr.PAN,
		Notes:         vr.Notes,
	}
	if vr.PaymentTerms != "" {
		if n, err := vr.PaymentTerms.Int64(); err == nil {
			v := int(n)
			s.PaymentTerms = &v
		}
	}
	return s
}

type VendorHandler struct {
	service *service.VendorService
}

func NewVendorHandler(vs *service.VendorService) *VendorHandler {
	return &VendorHandler{service: vs}
}

// GetAll GET /api/vendors
func (vh *VendorHandler) GetAll(w http.ResponseWriter, r *http.Request) {
	page, size := util.ParsePagination(r)

	search := r.URL.Query().Get("search")
	var searchPtr *string
	if search != "" {
		searchPtr = &search
	}

	active := r.URL.Query().Get("active")
	var activePtr *bool
	if active != "" {
		a := active == "true"
		activePtr = &a
	}

	vendors, total, err := vh.service.GetAll(page, size, searchPtr, activePtr)
	if err != nil {
		handleError(w, err)
		return
	}

	totalPages := int((total + int64(size) - 1) / int64(size))
	util.SendPaginated(w, vendors, total, totalPages, size, page)
}

// GetByID GET /api/vendors/{id}
func (vh *VendorHandler) GetByID(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid vendor ID")
		return
	}

	vendor, err := vh.service.GetByID(id)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "Vendor retrieved", vendor)
}

// Create POST /api/vendors
func (vh *VendorHandler) Create(w http.ResponseWriter, r *http.Request) {
	var vr vendorRequest
	if err := json.NewDecoder(r.Body).Decode(&vr); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req := vr.toSupplier()
	req.Active = true
	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	req.CreatedBy = &user.Email

	vendor, err := vh.service.Create(req)
	if err != nil {
		handleError(w, err)
		return
	}

	slog.Info("Vendor created", "id", vendor.ID, "name", vendor.Name, "user", user.Email)
	util.SendSuccess(w, "Vendor created", vendor)
}

// Update PUT /api/vendors/{id}
func (vh *VendorHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid vendor ID")
		return
	}

	var vr vendorRequest
	if err := json.NewDecoder(r.Body).Decode(&vr); err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	req := vr.toSupplier()
	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	req.UpdatedBy = &user.Email

	vendor, err := vh.service.Update(id, req)
	if err != nil {
		handleError(w, err)
		return
	}

	slog.Info("Vendor updated", "id", vendor.ID, "name", vendor.Name, "user", user.Email)
	util.SendSuccess(w, "Vendor updated", vendor)
}

// Delete DELETE /api/vendors/{id}
func (vh *VendorHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.Atoi(r.PathValue("id"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid vendor ID")
		return
	}

	vendor, err := vh.service.GetByID(id)
	if err != nil {
		handleError(w, err)
		return
	}

	err = vh.service.Delete(id)
	if err != nil {
		handleError(w, err)
		return
	}

	user := r.Context().Value(middleware.UserContextKey).(*middleware.AuthUser)
	slog.Info("Vendor deleted", "id", id, "name", vendor.Name, "user", user.Email)

	util.SendSuccess(w, "Vendor deleted", map[string]int{"id": id})
}

// ImportCSV POST /api/vendors/import
func (vh *VendorHandler) ImportCSV(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		util.SendError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// Parse multipart form
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		util.SendError(w, http.StatusBadRequest, "Failed to parse form")
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "File is required")
		return
	}
	defer file.Close()

	imported, err := vh.service.ImportCSV(file)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, fmt.Sprintf("Imported %d vendors", imported), map[string]int{"imported": imported})
}

// GetImportTemplate GET /api/vendors/import/template
func (vh *VendorHandler) GetImportTemplate(w http.ResponseWriter, r *http.Request) {
	template, err := vh.service.GetImportTemplate()
	if err != nil {
		handleError(w, err)
		return
	}

	w.Header().Set("Content-Disposition", "attachment; filename=vendors_template.csv")
	w.Header().Set("Content-Type", "text/csv")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(template))
}

// ExportCSV GET /api/vendors/export/csv
func (vh *VendorHandler) ExportCSV(w http.ResponseWriter, r *http.Request) {
	csv, err := vh.service.ExportCSV()
	if err != nil {
		handleError(w, err)
		return
	}

	w.Header().Set("Content-Disposition", "attachment; filename=vendors_export.csv")
	w.Header().Set("Content-Type", "text/csv")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(csv))
}
