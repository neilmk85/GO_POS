package service

import (
	"encoding/json"
	"time"

	"github.com/nilesh/pos-backend/internal/models"
	"gorm.io/gorm"
)

type IncentiveService struct {
	db *gorm.DB
}

func NewIncentiveService(db *gorm.DB) *IncentiveService {
	return &IncentiveService{db: db}
}

// ─── Incentive Rules ──────────────────────────────────────────────────────

type IncentiveRuleRequest struct {
	Name                 string   `json:"name"`
	Description          *string  `json:"description"`
	RuleType             string   `json:"ruleType"`
	CommissionRate       *float64 `json:"commissionRate"`
	TargetAmount         *float64 `json:"targetAmount"`
	BonusAmount          *float64 `json:"bonusAmount"`
	MinTransactionAmount *float64 `json:"minTransactionAmount"`
	BonusPerTransaction  *float64 `json:"bonusPerTransaction"`
	Tiers                *string  `json:"tiers"`
	ApplyToAll           bool     `json:"applyToAll"`
	StaffIds             *[]int   `json:"staffIds"`
	OutletID             *int     `json:"outletId"`
	Active               bool     `json:"active"`
}

func (is *IncentiveService) GetRules(outletId *int) ([]models.IncentiveRule, error) {
	var rules []models.IncentiveRule

	query := is.db
	if outletId != nil {
		query = query.Where("outlet_id = ?", *outletId)
	}

	if err := query.Preload("Outlet").Order("created_at DESC").Find(&rules).Error; err != nil {
		return nil, err
	}

	return rules, nil
}

func (is *IncentiveService) CreateRule(req IncentiveRuleRequest) (models.IncentiveRule, error) {
	var staffIds *string
	if req.StaffIds != nil && len(*req.StaffIds) > 0 {
		data, _ := json.Marshal(*req.StaffIds)
		staffIds = stringPtr(string(data))
	}

	rule := models.IncentiveRule{
		Name:                 req.Name,
		Description:          req.Description,
		RuleType:             models.IncentiveRuleType(req.RuleType),
		CommissionRate:       req.CommissionRate,
		TargetAmount:         req.TargetAmount,
		BonusAmount:          req.BonusAmount,
		MinTransactionAmount: req.MinTransactionAmount,
		BonusPerTransaction:  req.BonusPerTransaction,
		Tiers:                req.Tiers,
		ApplyToAll:           req.ApplyToAll,
		StaffIds:             staffIds,
		OutletID:             req.OutletID,
		Active:               req.Active,
	}

	if err := is.db.Create(&rule).Error; err != nil {
		return rule, err
	}

	if err := is.db.Preload("Outlet").First(&rule, rule.ID).Error; err != nil {
		return rule, err
	}

	return rule, nil
}

func (is *IncentiveService) UpdateRule(id int, req IncentiveRuleRequest) (models.IncentiveRule, error) {
	rule := models.IncentiveRule{}

	var staffIds *string
	if req.StaffIds != nil && len(*req.StaffIds) > 0 {
		data, _ := json.Marshal(*req.StaffIds)
		staffIds = stringPtr(string(data))
	}

	updates := map[string]interface{}{
		"name":                     req.Name,
		"description":              req.Description,
		"rule_type":                req.RuleType,
		"commission_rate":          req.CommissionRate,
		"target_amount":            req.TargetAmount,
		"bonus_amount":             req.BonusAmount,
		"min_transaction_amount":   req.MinTransactionAmount,
		"bonus_per_transaction":    req.BonusPerTransaction,
		"tiers":                    req.Tiers,
		"apply_to_all":             req.ApplyToAll,
		"staff_ids":                staffIds,
		"outlet_id":                req.OutletID,
		"is_active":                req.Active,
	}

	if err := is.db.Model(&rule).Where("id = ?", id).Updates(updates).Error; err != nil {
		return rule, err
	}

	if err := is.db.Preload("Outlet").First(&rule, id).Error; err != nil {
		return rule, err
	}

	return rule, nil
}

func (is *IncentiveService) DeleteRule(id int) error {
	return is.db.Delete(&models.IncentiveRule{}, id).Error
}

// ─── Incentive Payouts ────────────────────────────────────────────────────

type IncentivePayoutResponse struct {
	ID                 int     `json:"id"`
	StaffID            int     `json:"staffId"`
	StaffName          string  `json:"staffName"`
	OutletID           int     `json:"outletId"`
	Month              int     `json:"month"`
	Year               int     `json:"year"`
	TotalSales         float64 `json:"totalSales"`
	TotalTransactions  int     `json:"totalTransactions"`
	CommissionEarned   float64 `json:"commissionEarned"`
	BonusEarned        float64 `json:"bonusEarned"`
	TotalIncentive     float64 `json:"totalIncentive"`
}

type LeaderboardEntry struct {
	StaffID          int     `json:"staffId"`
	StaffName        string  `json:"staffName"`
	TotalSales       float64 `json:"totalSales"`
	TotalTransactions int    `json:"totalTransactions"`
	TotalIncentive   float64 `json:"totalIncentive"`
	Rank             int     `json:"rank"`
}

func (is *IncentiveService) GetPayouts(outletId int, month, year int) ([]IncentivePayoutResponse, error) {
	var payouts []models.IncentivePayout

	query := is.db.Where("outlet_id = ?", outletId)
	if month > 0 {
		query = query.Where("month = ?", month)
	}
	if year > 0 {
		query = query.Where("year = ?", year)
	}

	if err := query.Order("year DESC, month DESC").Find(&payouts).Error; err != nil {
		return nil, err
	}

	result := make([]IncentivePayoutResponse, len(payouts))
	for i, p := range payouts {
		result[i] = IncentivePayoutResponse{
			ID:                p.ID,
			StaffID:           p.StaffID,
			StaffName:         p.StaffName,
			OutletID:          p.OutletID,
			Month:             p.Month,
			Year:              p.Year,
			TotalSales:        p.TotalSales,
			TotalTransactions: p.TotalTransactions,
			CommissionEarned:  p.CommissionEarned,
			BonusEarned:       p.BonusEarned,
			TotalIncentive:    p.TotalIncentive,
		}
	}

	return result, nil
}

func (is *IncentiveService) GetLeaderboard(outletId int, month, year int) ([]LeaderboardEntry, error) {
	var payouts []models.IncentivePayout

	query := is.db.Where("outlet_id = ?", outletId)
	if month > 0 {
		query = query.Where("month = ?", month)
	}
	if year > 0 {
		query = query.Where("year = ?", year)
	}

	if err := query.Order("total_incentive DESC").Find(&payouts).Error; err != nil {
		return nil, err
	}

	result := make([]LeaderboardEntry, len(payouts))
	for i, p := range payouts {
		result[i] = LeaderboardEntry{
			StaffID:          p.StaffID,
			StaffName:        p.StaffName,
			TotalSales:       p.TotalSales,
			TotalTransactions: p.TotalTransactions,
			TotalIncentive:   p.TotalIncentive,
			Rank:             i + 1,
		}
	}

	return result, nil
}

type RecalculateRequest struct {
	OutletID int `json:"outletId"`
	Month    int `json:"month"`
	Year     int `json:"year"`
}

func (is *IncentiveService) Recalculate(req RecalculateRequest) (int, error) {
	startDate := time.Date(req.Year, time.Month(req.Month), 1, 0, 0, 0, 0, time.UTC)
	endDate := time.Date(req.Year, time.Month(req.Month)+1, 0, 23, 59, 59, 0, time.UTC)

	// Get all staff members with completed orders in this period
	var orders []models.Order
	if err := is.db.Where("outlet_id = ? AND status = ? AND created_at >= ? AND created_at <= ?",
		req.OutletID, "COMPLETED", startDate, endDate).
		Preload("CashierDetails").
		Find(&orders).Error; err != nil {
		return 0, err
	}

	// Group by staff
	staffStats := make(map[int]map[string]interface{})
	for _, order := range orders {
		if order.CashierID == 0 {
			continue
		}

		if _, exists := staffStats[order.CashierID]; !exists {
			staffStats[order.CashierID] = map[string]interface{}{
				"totalSales":        0.0,
				"totalTransactions": 0,
				"staffName":         "",
			}
		}

		stats := staffStats[order.CashierID]
		stats["totalSales"] = stats["totalSales"].(float64) + order.TotalAmount.InexactFloat64()
		stats["totalTransactions"] = stats["totalTransactions"].(int) + 1
	}

	// Get incentive rules for outlet
	var rules []models.IncentiveRule
	if err := is.db.Where("is_active = ? AND (outlet_id = ? OR outlet_id IS NULL)", true, req.OutletID).
		Find(&rules).Error; err != nil {
		return 0, err
	}

	// Calculate payouts
	count := 0
	for staffId, stats := range staffStats {
		totalSales := stats["totalSales"].(float64)
		totalTransactions := stats["totalTransactions"].(int)

		var commissionEarned, bonusEarned float64

		for _, rule := range rules {
			if !rule.ApplyToAll && rule.StaffIds != nil {
				// Check if staff is in the list
				var staffIds []int
				if err := json.Unmarshal([]byte(*rule.StaffIds), &staffIds); err == nil {
					found := false
					for _, sid := range staffIds {
						if sid == staffId {
							found = true
							break
						}
					}
					if !found {
						continue
					}
				}
			}

			if rule.RuleType == "COMMISSION" && rule.CommissionRate != nil {
				commissionEarned += (totalSales * (*rule.CommissionRate)) / 100
			} else if rule.RuleType == "TARGET_BONUS" && rule.TargetAmount != nil && rule.BonusAmount != nil {
				if totalSales >= *rule.TargetAmount {
					bonusEarned += *rule.BonusAmount
				}
			} else if rule.RuleType == "PER_TRANSACTION" && rule.BonusPerTransaction != nil && rule.MinTransactionAmount != nil {
				eligibleTxns := 0
				for _, order := range orders {
					if order.CashierID == staffId && order.TotalAmount.InexactFloat64() >= *rule.MinTransactionAmount {
						eligibleTxns++
					}
				}
				bonusEarned += float64(eligibleTxns) * (*rule.BonusPerTransaction)
			}
		}

		// Get staff name
		staffUser := &models.User{}
		staffName := ""
		if err := is.db.First(staffUser, staffId).Error; err == nil {
			staffName = staffUser.Name
		}

		payout := &models.IncentivePayout{
			StaffID:           staffId,
			StaffName:         staffName,
			OutletID:          req.OutletID,
			Month:             req.Month,
			Year:              req.Year,
			TotalSales:        totalSales,
			TotalTransactions: totalTransactions,
			CommissionEarned:  commissionEarned,
			BonusEarned:       bonusEarned,
			TotalIncentive:    commissionEarned + bonusEarned,
		}

		// Upsert payout
		if err := is.db.Clauses().Create(payout).Error; err == nil {
			count++
		}
	}

	return count, nil
}

// Helper function
func stringPtr(s string) *string {
	return &s
}

func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
