package service

import (
	"encoding/csv"
	"fmt"
	"io"
	"strings"

	"github.com/nilesh/pos-backend/internal/models"
	"github.com/nilesh/pos-backend/internal/util"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type CustomerService struct {
	db *gorm.DB
}

func NewCustomerService(db *gorm.DB) *CustomerService {
	return &CustomerService{db: db}
}

// GetAll returns paginated list of customers with optional filtering
func (cs *CustomerService) GetAll(page, size int, search *string, segment *string, active *bool) (customers []models.Customer, total int64, err error) {
	query := cs.db

	if search != nil && *search != "" {
		searchPattern := "%" + *search + "%"
		query = query.Where("name LIKE ? OR phone LIKE ? OR email LIKE ?",
			searchPattern, searchPattern, searchPattern)
	}

	if segment != nil && *segment != "" {
		query = query.Where("segment = ?", *segment)
	}

	if active != nil {
		query = query.Where("is_active = ?", *active)
	}

	if err := query.Model(&models.Customer{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := page * size
	err = query.
		Order("created_at DESC").
		Offset(offset).
		Limit(size).
		Find(&customers).Error

	return customers, total, err
}

// GetByID returns a single customer by ID
func (cs *CustomerService) GetByID(id int) (*models.Customer, error) {
	customer := &models.Customer{}
	err := cs.db.First(customer, id).Error
	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Customer with ID %d not found", id)}
	}
	return customer, err
}

// GetByPhone returns a customer by phone number
func (cs *CustomerService) GetByPhone(phone string) (*models.Customer, error) {
	customer := &models.Customer{}
	err := cs.db.Where("phone = ?", phone).First(customer).Error
	if err == gorm.ErrRecordNotFound {
		return nil, &util.ResourceNotFoundException{Message: fmt.Sprintf("Customer with phone %s not found", phone)}
	}
	return customer, err
}

// Search returns customers matching query on name, phone, or email
func (cs *CustomerService) Search(q string) ([]models.Customer, error) {
	var customers []models.Customer
	searchPattern := "%" + q + "%"
	err := cs.db.Where("is_active = ? AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)",
		true, searchPattern, searchPattern, searchPattern).
		Limit(20).
		Find(&customers).Error
	return customers, err
}

// GetWithDues returns customers with outstanding dues
func (cs *CustomerService) GetWithDues() ([]models.Customer, error) {
	var customers []models.Customer
	err := cs.db.Where("outstanding_due > ?", 0).
		Order("outstanding_due DESC").
		Find(&customers).Error
	return customers, err
}

// GetLoyaltyHistory returns paginated loyalty transactions for a customer
func (cs *CustomerService) GetLoyaltyHistory(customerId, page, size int) (transactions []models.LoyaltyTransaction, total int64, err error) {
	query := cs.db.Where("customer_id = ?", customerId)

	if err := query.Model(&models.LoyaltyTransaction{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := page * size
	err = query.
		Order("created_at DESC").
		Offset(offset).
		Limit(size).
		Find(&transactions).Error

	return transactions, total, err
}

// Create creates a new customer
func (cs *CustomerService) Create(data models.Customer) (*models.Customer, error) {
	// Check if phone already exists
	if data.Phone != nil && *data.Phone != "" {
		var existing models.Customer
		if err := cs.db.Where("phone = ?", *data.Phone).First(&existing).Error; err == nil {
			return nil, &util.BusinessException{
				StatusCode: 400,
				Message:    fmt.Sprintf("Phone %s already registered", *data.Phone),
			}
		}
	}

	if err := cs.db.Create(&data).Error; err != nil {
		return nil, err
	}
	return &data, nil
}

// Update updates an existing customer
func (cs *CustomerService) Update(id int, data models.Customer) (*models.Customer, error) {
	// Check if customer exists
	if _, err := cs.GetByID(id); err != nil {
		return nil, err
	}

	if err := cs.db.Model(&models.Customer{}).Where("id = ?", id).Updates(data).Error; err != nil {
		return nil, err
	}

	return cs.GetByID(id)
}

// AddLoyaltyPoints adds loyalty points to a customer
func (cs *CustomerService) AddLoyaltyPoints(customerId int, points decimal.Decimal, orderId *int, description *string) error {
	customer, err := cs.GetByID(customerId)
	if err != nil {
		return err
	}

	newBalance := customer.LoyaltyPoints.Add(points)

	return cs.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.Customer{}).Where("id = ?", customerId).
			Update("loyalty_points", newBalance).Error; err != nil {
			return err
		}

		loyalty := models.LoyaltyTransaction{
			CustomerID:   customerId,
			OrderID:      orderId,
			Type:         models.LoyaltyTransactionTypeEarned,
			Points:       points,
			BalanceAfter: &newBalance,
			Description:  description,
		}
		return tx.Create(&loyalty).Error
	})
}

// RedeemLoyaltyPoints redeems loyalty points from a customer
func (cs *CustomerService) RedeemLoyaltyPoints(customerId int, points decimal.Decimal) error {
	customer, err := cs.GetByID(customerId)
	if err != nil {
		return err
	}

	if points.GreaterThan(customer.LoyaltyPoints) {
		return &util.BusinessException{
			StatusCode: 400,
			Message:    "Insufficient loyalty points",
		}
	}

	newBalance := customer.LoyaltyPoints.Sub(points)
	negPoints := points.Neg()

	return cs.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.Customer{}).Where("id = ?", customerId).
			Update("loyalty_points", newBalance).Error; err != nil {
			return err
		}

		desc := "Points redeemed"
		loyalty := models.LoyaltyTransaction{
			CustomerID:   customerId,
			Type:         models.LoyaltyTransactionTypeRedeemed,
			Points:       negPoints,
			BalanceAfter: &newBalance,
			Description:  &desc,
		}
		return tx.Create(&loyalty).Error
	})
}

// UpdateTotalSpent increments the total spent amount for a customer
func (cs *CustomerService) UpdateTotalSpent(customerId int, amount decimal.Decimal) error {
	return cs.db.Model(&models.Customer{}).Where("id = ?", customerId).
		Update("total_spent", gorm.Expr("total_spent + ?", amount)).Error
}

// UpdateOutstandingDue increments the outstanding due amount for a customer
func (cs *CustomerService) UpdateOutstandingDue(customerId int, amount decimal.Decimal) error {
	return cs.db.Model(&models.Customer{}).Where("id = ?", customerId).
		Update("outstanding_due", gorm.Expr("outstanding_due + ?", amount)).Error
}

// ImportCSV imports customers from a CSV file
func (cs *CustomerService) ImportCSV(file io.Reader) (imported int, err error) {
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

		customer := models.Customer{
			Name: record[0],
		}

		if len(record) > 1 && record[1] != "" {
			customer.Phone = &record[1]
		}
		if len(record) > 2 && record[2] != "" {
			customer.Email = &record[2]
		}
		if len(record) > 3 && record[3] != "" {
			customer.City = &record[3]
		}
		if len(record) > 4 && record[4] != "" {
			customer.State = &record[4]
		}
		if len(record) > 5 && record[5] != "" {
			customer.Segment = models.CustomerSegment(record[5])
		} else {
			customer.Segment = models.CustomerSegmentRegular
		}

		// Check if phone exists
		if customer.Phone != nil && *customer.Phone != "" {
			var existing models.Customer
			if err := cs.db.Where("phone = ?", *customer.Phone).First(&existing).Error; err == nil {
				// Update existing customer
				cs.db.Model(&existing).Updates(customer)
				imported++
				continue
			}
		}

		// Create new customer
		if err := cs.db.Create(&customer).Error; err == nil {
			imported++
		}
	}

	return imported, nil
}

// ExportCSV exports all customers as CSV
func (cs *CustomerService) ExportCSV() (string, error) {
	customers, _, err := cs.GetAll(0, 10000, nil, nil, nil)
	if err != nil {
		return "", err
	}

	var sb strings.Builder
	writer := csv.NewWriter(&sb)

	// Write header
	writer.Write([]string{"name", "phone", "email", "city", "state", "segment", "loyaltyPoints", "totalSpent", "outstandingDue"})

	// Write data
	for _, c := range customers {
		phone := ""
		if c.Phone != nil {
			phone = *c.Phone
		}
		email := ""
		if c.Email != nil {
			email = *c.Email
		}
		city := ""
		if c.City != nil {
			city = *c.City
		}
		state := ""
		if c.State != nil {
			state = *c.State
		}

		writer.Write([]string{
			c.Name,
			phone,
			email,
			city,
			state,
			string(c.Segment),
			c.LoyaltyPoints.String(),
			c.TotalSpent.String(),
			c.OutstandingDue.String(),
		})
	}

	writer.Flush()
	return sb.String(), writer.Error()
}
