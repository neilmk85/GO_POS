package util

import (
	"encoding/csv"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
)

func ParseCSVFile(file multipart.File) ([][]string, error) {
	reader := csv.NewReader(file)

	var records [][]string
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}

	return records, nil
}

func WriteCSV(w http.ResponseWriter, filename string, headers []string, rows [][]string) {
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))

	writer := csv.NewWriter(w)
	defer writer.Flush()

	writer.Write(headers)
	for _, row := range rows {
		writer.Write(row)
	}
}
