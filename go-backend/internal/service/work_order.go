package service

import (
	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"gorm.io/gorm"
)

type WorkOrderService struct {
	db *gorm.DB
}

func NewWorkOrderService(db *gorm.DB) *WorkOrderService {
	return &WorkOrderService{db: db}
}

func (s *WorkOrderService) GetAll(search string, status string) ([]models.WorkOrder, error) {
	var orders []models.WorkOrder
	q := s.db.Preload("Items").Order("created_at DESC")
	if search != "" {
		like := "%" + search + "%"
		q = q.Where("wo_number LIKE ? OR title LIKE ? OR contractor_name LIKE ?", like, like, like)
	}
	if status != "" && status != "ALL" {
		q = q.Where("status = ?", status)
	}
	return orders, q.Find(&orders).Error
}

func (s *WorkOrderService) GetByID(id int) (*models.WorkOrder, error) {
	var o models.WorkOrder
	err := s.db.Preload("Items").First(&o, id).Error
	return &o, err
}

func (s *WorkOrderService) Create(o models.WorkOrder, createdBy string) (*models.WorkOrder, error) {
	num, err := util.GenerateWONumber(s.db)
	if err != nil {
		return nil, err
	}
	o.WONumber = num
	o.CreatedBy = &createdBy
	o.UpdatedBy = &createdBy
	if err := s.db.Create(&o).Error; err != nil {
		return nil, err
	}
	return s.GetByID(o.ID)
}

func (s *WorkOrderService) Update(id int, patch models.WorkOrder, updatedBy string) (*models.WorkOrder, error) {
	var o models.WorkOrder
	if err := s.db.First(&o, id).Error; err != nil {
		return nil, err
	}
	patch.UpdatedBy = &updatedBy
	// Replace items: delete old, insert new
	if err := s.db.Where("work_order_id = ?", id).Delete(&models.WorkOrderItem{}).Error; err != nil {
		return nil, err
	}
	o.ContractorID = patch.ContractorID
	o.ContractorName = patch.ContractorName
	o.Title = patch.Title
	o.Location = patch.Location
	o.StartDate = patch.StartDate
	o.EndDate = patch.EndDate
	o.Status = patch.Status
	o.Notes = patch.Notes
	o.UpdatedBy = patch.UpdatedBy
	if err := s.db.Save(&o).Error; err != nil {
		return nil, err
	}
	for i := range patch.Items {
		patch.Items[i].WorkOrderID = id
		patch.Items[i].ID = 0
	}
	if len(patch.Items) > 0 {
		if err := s.db.Create(&patch.Items).Error; err != nil {
			return nil, err
		}
	}
	return s.GetByID(id)
}

func (s *WorkOrderService) UpdateStatus(id int, status models.WorkOrderStatus, updatedBy string) (*models.WorkOrder, error) {
	if err := s.db.Model(&models.WorkOrder{}).Where("id = ?", id).
		Updates(map[string]interface{}{"status": status, "updated_by": updatedBy}).Error; err != nil {
		return nil, err
	}
	return s.GetByID(id)
}

func (s *WorkOrderService) Delete(id int) error {
	return s.db.Delete(&models.WorkOrder{}, id).Error
}
