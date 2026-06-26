package service

import (
	"encoding/csv"
	"fmt"
	"io"
	"strings"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"gorm.io/gorm"
)

type VendorService struct {
	db *gorm.DB
}

func NewVendorService(db *gorm.DB) *VendorService {
	return &VendorService{db: db}
}

// GetAll returns paginated list of vendors with optional filtering
func (vs *VendorService) GetAll(page, size int, search *string, active *bool, vendorType *string) (vendors []models.Supplier, total int64, err error) {
	query := vs.db

	if search != nil && *search != "" {
		searchPattern := "%" + *search + "%"
		query = query.Where("name LIKE ? OR contact_person LIKE ? OR phone LIKE ? OR email LIKE ?",
			searchPattern, searchPattern, searchPattern, searchPattern)
	}

	if active != nil {
		query = query.Where("is_active = ?", *active)
	}

	if vendorType != nil && *vendorType != "" {
		query = query.Where("vendor_type = ?", *vendorType)
	}

	if err := query.Model(&models.Supplier{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := page * size
	err = query.
		Order("name ASC").
		Offset(offset).
		Limit(size).
		Find(&vendors).Error

	return vendors, total, err
}

// GetByID returns a single vendor by ID
func (vs *VendorService) GetByID(id int) (*models.Supplier, error) {
	vendor := &models.Supplier{}
	err := vs.db.First(vendor, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Vendor with ID %d not found", id)}
	}
	return vendor, err
}

// Create creates a new vendor
func (vs *VendorService) Create(data models.Supplier) (*models.Supplier, error) {
	if err := vs.db.Create(&data).Error; err != nil {
		return nil, err
	}
	return &data, nil
}

// Update updates an existing vendor
func (vs *VendorService) Update(id int, data models.Supplier) (*models.Supplier, error) {
	// Check if vendor exists
	if _, err := vs.GetByID(id); err != nil {
		return nil, err
	}

	if err := vs.db.Model(&models.Supplier{}).Where("id = ?", id).Updates(data).Error; err != nil {
		return nil, err
	}

	return vs.GetByID(id)
}

// Delete marks a vendor as inactive
func (vs *VendorService) Delete(id int) error {
	vendor, err := vs.GetByID(id)
	if err != nil {
		return err
	}

	return vs.db.Model(vendor).Update("is_active", false).Error
}

// ImportCSV imports vendors from a CSV file
func (vs *VendorService) ImportCSV(file io.Reader) (imported int, err error) {
	reader := csv.NewReader(file)

	// Skip header
	_, err = reader.Read()
	if err != nil {
		return 0, err
	}

	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return imported, err
		}

		if len(record) < 1 {
			continue
		}

		vendor := models.Supplier{
			Name:   record[0],
			Active: true,
		}

		if len(record) > 1 && record[1] != "" {
			vendor.ContactPerson = &record[1]
		}
		if len(record) > 2 && record[2] != "" {
			vendor.Phone = &record[2]
		}
		if len(record) > 3 && record[3] != "" {
			vendor.Email = &record[3]
		}
		if len(record) > 4 && record[4] != "" {
			vendor.City = &record[4]
		}
		if len(record) > 5 && record[5] != "" {
			vendor.State = &record[5]
		}
		if len(record) > 6 && record[6] != "" {
			vendor.GSTIN = &record[6]
		}
		if len(record) > 7 && record[7] != "" {
			vendor.PAN = &record[7]
		}

		if err := vs.db.Create(&vendor).Error; err == nil {
			imported++
		}
	}

	return imported, nil
}

// GetImportTemplate returns CSV template for vendors
func (vs *VendorService) GetImportTemplate() (string, error) {
	var sb strings.Builder
	writer := csv.NewWriter(&sb)

	// Write header
	writer.Write([]string{"name", "contactPerson", "phone", "email", "city", "state", "gstin", "pan"})

	writer.Flush()
	return sb.String(), writer.Error()
}

// ExportCSV exports all active vendors as CSV
func (vs *VendorService) ExportCSV() (string, error) {
	var vendors []models.Supplier
	if err := vs.db.Where("is_active = ?", true).Order("name ASC").Find(&vendors).Error; err != nil {
		return "", err
	}

	var sb strings.Builder
	writer := csv.NewWriter(&sb)

	// Write header
	writer.Write([]string{"name", "contactPerson", "phone", "email", "city", "state", "gstin", "pan"})

	// Write data
	for _, v := range vendors {
		contactPerson := ""
		if v.ContactPerson != nil {
			contactPerson = *v.ContactPerson
		}
		phone := ""
		if v.Phone != nil {
			phone = *v.Phone
		}
		email := ""
		if v.Email != nil {
			email = *v.Email
		}
		city := ""
		if v.City != nil {
			city = *v.City
		}
		state := ""
		if v.State != nil {
			state = *v.State
		}
		gstin := ""
		if v.GSTIN != nil {
			gstin = *v.GSTIN
		}
		pan := ""
		if v.PAN != nil {
			pan = *v.PAN
		}

		writer.Write([]string{
			v.Name,
			contactPerson,
			phone,
			email,
			city,
			state,
			gstin,
			pan,
		})
	}

	writer.Flush()
	return sb.String(), writer.Error()
}
