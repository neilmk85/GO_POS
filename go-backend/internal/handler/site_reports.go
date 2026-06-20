package handler

import (
	"net/http"
	"strconv"

	"github.com/nilesh/pos-backend/internal/service"
	"github.com/nilesh/pos-backend/internal/util"
)

type SiteReportHandler struct {
	service *service.SiteReportService
}

func NewSiteReportHandler(s *service.SiteReportService) *SiteReportHandler {
	return &SiteReportHandler{service: s}
}

// GetDashboard GET /api/site-projects/{projectId}/dashboard
func (h *SiteReportHandler) GetDashboard(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.Atoi(r.PathValue("projectId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid project ID")
		return
	}
	data, err := h.service.GetDashboard(projectID)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Dashboard data retrieved", data)
}

// GetFinancialSummary GET /api/site-projects/{projectId}/financial-summary
func (h *SiteReportHandler) GetFinancialSummary(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.Atoi(r.PathValue("projectId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid project ID")
		return
	}
	data, err := h.service.GetFinancialSummary(projectID)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Financial summary retrieved", data)
}

// GetProgressReport GET /api/site-projects/{projectId}/progress-report
func (h *SiteReportHandler) GetProgressReport(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.Atoi(r.PathValue("projectId"))
	if err != nil {
		util.SendError(w, http.StatusBadRequest, "Invalid project ID")
		return
	}
	data, err := h.service.GetProgressReport(projectID)
	if err != nil {
		handleError(w, err)
		return
	}
	util.SendSuccess(w, "Progress report retrieved", data)
}
