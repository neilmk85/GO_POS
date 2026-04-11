package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type GSTHandler struct {
	service *service.GSTService
}

func NewGSTHandler(gs *service.GSTService) *GSTHandler {
	return &GSTHandler{service: gs}
}

func parseGSTParams(r *http.Request) (int, time.Time, time.Time, error) {
	outletId, err := strconv.Atoi(r.URL.Query().Get("outletId"))
	if err != nil {
		return 0, time.Time{}, time.Time{}, err
	}

	from, err := time.Parse("2006-01-02", r.URL.Query().Get("from"))
	if err != nil {
		return 0, time.Time{}, time.Time{}, err
	}

	toStr := r.URL.Query().Get("to")
	to, err := time.Parse("2006-01-02", toStr)
	if err != nil {
		return 0, time.Time{}, time.Time{}, err
	}
	to = to.Add(time.Hour*23 + time.Minute*59 + time.Second*59)

	return outletId, from, to, nil
}

func (gh *GSTHandler) GSTR1(w http.ResponseWriter, r *http.Request) {
	outletId, from, to, err := parseGSTParams(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid parameters")
		return
	}

	result, err := gh.service.GSTR1(outletId, from, to)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "GSTR-1 retrieved", result)
}

func (gh *GSTHandler) ExportGSTR1(w http.ResponseWriter, r *http.Request) {
	outletId, from, to, err := parseGSTParams(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid parameters")
		return
	}

	csv, err := gh.service.ExportGSTR1(outletId, from, to)
	if err != nil {
		handleError(w, err)
		return
	}

	w.Header().Set("Content-Disposition", "attachment; filename=\"GSTR1_"+r.URL.Query().Get("from")+"_"+r.URL.Query().Get("to")+".csv\"")
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Write([]byte(csv))
}

func (gh *GSTHandler) GSTR3B(w http.ResponseWriter, r *http.Request) {
	outletId, from, to, err := parseGSTParams(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid parameters")
		return
	}

	result, err := gh.service.GSTR3B(outletId, from, to)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "GSTR-3B retrieved", result)
}

func (gh *GSTHandler) ExportGSTR3B(w http.ResponseWriter, r *http.Request) {
	outletId, from, to, err := parseGSTParams(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid parameters")
		return
	}

	csv, err := gh.service.ExportGSTR3B(outletId, from, to)
	if err != nil {
		handleError(w, err)
		return
	}

	w.Header().Set("Content-Disposition", "attachment; filename=\"GSTR3B_"+r.URL.Query().Get("from")+"_"+r.URL.Query().Get("to")+".csv\"")
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Write([]byte(csv))
}

func (gh *GSTHandler) HSNSummary(w http.ResponseWriter, r *http.Request) {
	outletId, from, to, err := parseGSTParams(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid parameters")
		return
	}

	result, err := gh.service.HSNSummary(outletId, from, to)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "HSN summary retrieved", result)
}

func (gh *GSTHandler) ExportHSNSummary(w http.ResponseWriter, r *http.Request) {
	outletId, from, to, err := parseGSTParams(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid parameters")
		return
	}

	csv, err := gh.service.ExportHSNSummary(outletId, from, to)
	if err != nil {
		handleError(w, err)
		return
	}

	w.Header().Set("Content-Disposition", "attachment; filename=\"HSN_Summary_"+r.URL.Query().Get("from")+"_"+r.URL.Query().Get("to")+".csv\"")
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Write([]byte(csv))
}

func (gh *GSTHandler) HSNPurchaseSummary(w http.ResponseWriter, r *http.Request) {
	outletId, from, to, err := parseGSTParams(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid parameters")
		return
	}

	result, err := gh.service.HSNPurchaseSummary(outletId, from, to)
	if err != nil {
		handleError(w, err)
		return
	}

	util.SendSuccess(w, "HSN purchase summary retrieved", result)
}

func (gh *GSTHandler) ExportHSNPurchaseSummary(w http.ResponseWriter, r *http.Request) {
	outletId, from, to, err := parseGSTParams(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid parameters")
		return
	}

	csv, err := gh.service.ExportHSNPurchaseSummary(outletId, from, to)
	if err != nil {
		handleError(w, err)
		return
	}

	w.Header().Set("Content-Disposition", "attachment; filename=\"HSN_Purchase_"+r.URL.Query().Get("from")+"_"+r.URL.Query().Get("to")+".csv\"")
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Write([]byte(csv))
}

func (gh *GSTHandler) TallyExport(w http.ResponseWriter, r *http.Request) {
	outletId, from, to, err := parseGSTParams(r)
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid parameters")
		return
	}

	xml, err := gh.service.TallyExport(outletId, from, to)
	if err != nil {
		handleError(w, err)
		return
	}

	w.Header().Set("Content-Disposition", "attachment; filename=\"Tally_Export_"+r.URL.Query().Get("from")+"_"+r.URL.Query().Get("to")+".xml\"")
	w.Header().Set("Content-Type", "application/xml; charset=utf-8")
	w.Write([]byte(xml))
}
