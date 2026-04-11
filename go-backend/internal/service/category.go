package service

import (
	"fmt"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"gorm.io/gorm"
)

type CategoryService struct {
	db *gorm.DB
}

func NewCategoryService(db *gorm.DB) *CategoryService {
	return &CategoryService{db: db}
}

// GetAll returns all categories with parent relation
func (cs *CategoryService) GetAll() (categories []models.Category, err error) {
	err = cs.db.
		Preload("Parent").
		Order("display_order ASC").
		Find(&categories).Error
	return categories, err
}

// GetRoots returns root categories (where parentId is NULL)
func (cs *CategoryService) GetRoots() (categories []models.Category, err error) {
	err = cs.db.
		Where("parent_id IS NULL").
		Preload("Children").
		Order("display_order ASC").
		Find(&categories).Error
	return categories, err
}

// GetChildren returns children of a category
func (cs *CategoryService) GetChildren(parentId int) (categories []models.Category, err error) {
	err = cs.db.
		Where("parent_id = ?", parentId).
		Order("display_order ASC").
		Find(&categories).Error
	return categories, err
}

// GetByID returns a single category by ID
func (cs *CategoryService) GetByID(id int) (category *models.Category, err error) {
	category = &models.Category{}
	err = cs.db.
		Preload("Parent").
		Preload("Children").
		First(category, id).Error

	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Category with ID %d not found", id)}
	}
	return category, err
}

// CreateCategoryDTO for category creation
type CreateCategoryDTO struct {
	Name        string `json:"name"`
	Description *string `json:"description"`
	ImageURL    *string `json:"imageUrl"`
	DisplayOrder int    `json:"displayOrder"`
	Active      bool   `json:"active"`
	ParentID    *int   `json:"parentId"`
	CreatedBy   *string `json:"createdBy"`
}

// Create creates a new category
func (cs *CategoryService) Create(dto CreateCategoryDTO) (category *models.Category, err error) {
	category = &models.Category{
		Name:         dto.Name,
		Description:  dto.Description,
		ImageURL:     dto.ImageURL,
		DisplayOrder: dto.DisplayOrder,
		Active:       dto.Active,
		ParentID:     dto.ParentID,
		CreatedBy:    dto.CreatedBy,
	}

	err = cs.db.Create(category).Error
	if err != nil {
		return nil, err
	}

	return cs.GetByID(category.ID)
}

// Update updates an existing category
func (cs *CategoryService) Update(id int, dto CreateCategoryDTO) (category *models.Category, err error) {
	category = &models.Category{}
	if err := cs.db.First(category, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Category with ID %d not found", id)}
		}
		return nil, err
	}

	updates := map[string]interface{}{
		"name":          dto.Name,
		"description":   dto.Description,
		"image_url":     dto.ImageURL,
		"display_order": dto.DisplayOrder,
		"is_active":     dto.Active,
		"updated_by":    dto.CreatedBy,
	}

	if dto.ParentID != nil {
		updates["parent_id"] = *dto.ParentID
	} else {
		updates["parent_id"] = nil
	}

	if err := cs.db.Model(category).Updates(updates).Error; err != nil {
		return nil, err
	}

	return cs.GetByID(id)
}

// ToggleActive toggles the active status
func (cs *CategoryService) ToggleActive(id int) (category *models.Category, err error) {
	category = &models.Category{}
	if err := cs.db.First(category, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Category with ID %d not found", id)}
		}
		return nil, err
	}

	newActive := !category.Active
	if err := cs.db.Model(category).Update("is_active", newActive).Error; err != nil {
		return nil, err
	}

	category.Active = newActive
	return category, nil
}

// Delete deletes a category
func (cs *CategoryService) Delete(id int) error {
	category := &models.Category{}
	if err := cs.db.First(category, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return &util.ResourceNotFoundException{Message: fmt.Sprintf("Category with ID %d not found", id)}
		}
		return err
	}

	return cs.db.Delete(category).Error
}
