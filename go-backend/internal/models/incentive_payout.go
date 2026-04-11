package models

type IncentivePayout struct {
	ID                int     `gorm:"primaryKey;autoIncrement;column:id" json:"id"`
	StaffID           int     `gorm:"uniqueIndex:idx_staff_outlet_month_year;column:staff_id" json:"staffId"`
	StaffName         string  `gorm:"column:staff_name" json:"staffName"`
	OutletID          int     `gorm:"uniqueIndex:idx_staff_outlet_month_year;column:outlet_id" json:"outletId"`
	Month             int     `gorm:"uniqueIndex:idx_staff_outlet_month_year;column:month" json:"month"`
	Year              int     `gorm:"uniqueIndex:idx_staff_outlet_month_year;column:year" json:"year"`
	TotalSales        float64 `gorm:"column:total_sales;default:0" json:"totalSales"`
	TotalTransactions int     `gorm:"column:total_transactions;default:0" json:"totalTransactions"`
	CommissionEarned  float64 `gorm:"column:commission_earned;default:0" json:"commissionEarned"`
	BonusEarned       float64 `gorm:"column:bonus_earned;default:0" json:"bonusEarned"`
	TotalIncentive    float64 `gorm:"column:total_incentive;default:0" json:"totalIncentive"`
}

func (IncentivePayout) TableName() string {
	return "incentive_payouts"
}
