import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:pos_mobile/main.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../utils/parse.dart' as sp;
import 'debtors_screen.dart';
import 'gst_screen.dart';

class ReportsScreen extends ConsumerStatefulWidget {
  const ReportsScreen({super.key});

  @override
  ConsumerState<ReportsScreen> createState() => _ReportsScreenState();
}

class _ReportsScreenState extends ConsumerState<ReportsScreen> {
  DateTime _from = DateTime.now().subtract(const Duration(days: 7));
  DateTime _to = DateTime.now();
  Map<String, dynamic>? _summary;
  List<dynamic> _topProducts = [];
  List<dynamic> _dailyTrend = [];
  bool _loading = false;
  bool _exporting = false;

  final _fmt = DateFormat('yyyy-MM-dd');
  final _displayFmt = DateFormat('dd MMM');

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final outletId = ref.read(authProvider).user?.outletId;
    if (outletId == null) return;
    setState(() => _loading = true);
    try {
      final from = _fmt.format(_from);
      final to = _fmt.format(_to);
      final results = await Future.wait([
        ApiService().getSalesSummary(outletId, from, to),
        ApiService().getTopProducts(outletId, from, to),
        ApiService().getDailyTrend(outletId, from, to),
      ]);
      setState(() {
        _summary = results[0] as Map<String, dynamic>;
        _topProducts = results[1] as List;
        _dailyTrend = results[2] as List;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _pickRange() async {
    final range = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
      initialDateRange: DateTimeRange(start: _from, end: _to),
    );
    if (range != null) {
      setState(() {
        _from = range.start;
        _to = range.end;
      });
      _load();
    }
  }

  Future<void> _exportPdf() async {
    if (_summary == null) return;
    setState(() => _exporting = true);
    try {
      final doc = pw.Document();
      final outletName =
          ref.read(authProvider).user?.outletName ?? 'Sales Report';

      doc.addPage(
        pw.MultiPage(
          pageFormat: PdfPageFormat.a4,
          header: (ctx) => pw.Column(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Text(outletName,
                  style: pw.TextStyle(
                      fontSize: 18, fontWeight: pw.FontWeight.bold)),
              pw.Text(
                  'Sales Report  •  ${_fmt.format(_from)} to ${_fmt.format(_to)}',
                  style: pw.TextStyle(
                      fontSize: 11,
                      color: PdfColors.grey600)),
              pw.Divider(),
            ],
          ),
          build: (ctx) => [
            // Summary
            pw.Text('Summary',
                style: pw.TextStyle(
                    fontSize: 14, fontWeight: pw.FontWeight.bold)),
            pw.SizedBox(height: 8),
            pw.Table(
              border: pw.TableBorder.all(color: PdfColors.grey300),
              children: [
                pw.TableRow(
                  decoration: const pw.BoxDecoration(color: PdfColors.grey200),
                  children: [
                    _pdfCell('Metric', bold: true),
                    _pdfCell('Value', bold: true),
                  ],
                ),
                pw.TableRow(children: [
                  _pdfCell('Total Sales'),
                  _pdfCell(
                      '₹${_n(_summary!['totalSales'])}'),
                ]),
                pw.TableRow(children: [
                  _pdfCell('Total Orders'),
                  _pdfCell('${_summary!['totalOrders'] ?? 0}'),
                ]),
                pw.TableRow(children: [
                  _pdfCell('Avg Order Value'),
                  _pdfCell(
                      '₹${_n(_summary!['avgOrderValue'])}'),
                ]),
                pw.TableRow(children: [
                  _pdfCell('Items Sold'),
                  _pdfCell('${_summary!['totalItemsSold'] ?? 0}'),
                ]),
              ],
            ),
            pw.SizedBox(height: 20),
            // Daily trend table
            if (_dailyTrend.isNotEmpty) ...[
              pw.Text('Daily Trend',
                  style: pw.TextStyle(
                      fontSize: 14, fontWeight: pw.FontWeight.bold)),
              pw.SizedBox(height: 8),
              pw.Table(
                border: pw.TableBorder.all(color: PdfColors.grey300),
                children: [
                  pw.TableRow(
                    decoration:
                        const pw.BoxDecoration(color: PdfColors.grey200),
                    children: [
                      _pdfCell('Date', bold: true),
                      _pdfCell('Sales', bold: true),
                      _pdfCell('Orders', bold: true),
                    ],
                  ),
                  ..._dailyTrend.map(
                    (d) => pw.TableRow(children: [
                      _pdfCell(d['date'] ?? ''),
                      _pdfCell(
                          '₹${_n(d['totalSales'])}'),
                      _pdfCell('${d['orderCount'] ?? 0}'),
                    ]),
                  ),
                ],
              ),
              pw.SizedBox(height: 20),
            ],
            // Top products
            if (_topProducts.isNotEmpty) ...[
              pw.Text('Top Products',
                  style: pw.TextStyle(
                      fontSize: 14, fontWeight: pw.FontWeight.bold)),
              pw.SizedBox(height: 8),
              pw.Table(
                border: pw.TableBorder.all(color: PdfColors.grey300),
                children: [
                  pw.TableRow(
                    decoration:
                        const pw.BoxDecoration(color: PdfColors.grey200),
                    children: [
                      _pdfCell('Product', bold: true),
                      _pdfCell('Units', bold: true),
                      _pdfCell('Revenue', bold: true),
                    ],
                  ),
                  ..._topProducts.map(
                    (p) => pw.TableRow(children: [
                      _pdfCell(p['productName'] ?? ''),
                      _pdfCell(
                          sp.d(p['totalQuantity']).toStringAsFixed(0)),
                      _pdfCell(
                          '₹${_n(p['totalRevenue'])}'),
                    ]),
                  ),
                ],
              ),
            ],
          ],
        ),
      );

      await Printing.sharePdf(
        bytes: await doc.save(),
        filename:
            'sales_report_${_fmt.format(_from)}_${_fmt.format(_to)}.pdf',
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      if (mounted) setState(() => _exporting = false);
    }
  }

  pw.Widget _pdfCell(String text, {bool bold = false}) => pw.Padding(
        padding: const pw.EdgeInsets.all(6),
        child: pw.Text(
          text,
          style: pw.TextStyle(
              fontSize: 10,
              fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal),
        ),
      );

  String _n(dynamic v) => sp.d(v).toStringAsFixed(0);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.menu_outlined),
          onPressed: openAppDrawer,
          tooltip: 'Open menu',
        ),
        title: const Text('Reports'),
        actions: [
          TextButton.icon(
            icon: const Icon(Icons.calendar_today, size: 16),
            label: Text(
              '${_displayFmt.format(_from)} – ${_displayFmt.format(_to)}',
              style: const TextStyle(fontSize: 12),
            ),
            onPressed: _pickRange,
          ),
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
          IconButton(
            icon: _exporting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.share_outlined),
            onPressed: _summary == null || _exporting ? null : _exportPdf,
            tooltip: 'Export PDF',
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (_summary != null) _SummaryCards(summary: _summary!),
                  const SizedBox(height: 24),
                  if (_dailyTrend.isNotEmpty) ...[
                    const Text('Daily Sales Trend',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 12),
                    _DailyTrendChart(
                        data: _dailyTrend, displayFmt: _displayFmt),
                    const SizedBox(height: 24),
                  ],
                  if (_topProducts.isNotEmpty) ...[
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Top Products',
                            style: TextStyle(
                                fontSize: 16, fontWeight: FontWeight.bold)),
                        Text('${_topProducts.length} products',
                            style: const TextStyle(
                                color: Colors.grey, fontSize: 12)),
                      ],
                    ),
                    const SizedBox(height: 12),
                    _TopProductsList(products: _topProducts),
                  ],
                  const SizedBox(height: 24),
                  const Text('More Reports',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  _MoreReportsTile(
                    icon: Icons.account_balance_wallet_outlined,
                    color: const Color(0xFFE53935),
                    title: 'Debtors Ledger',
                    subtitle: 'Customer outstanding receivables',
                    onTap: () => Navigator.push(context,
                        MaterialPageRoute(builder: (_) => const DebtorsScreen())),
                  ),
                  _MoreReportsTile(
                    icon: Icons.store_outlined,
                    color: const Color(0xFF5E35B1),
                    title: 'Creditors Ledger',
                    subtitle: 'Vendor outstanding payables',
                    onTap: () => Navigator.push(context,
                        MaterialPageRoute(builder: (_) => const CreditorScreen())),
                  ),
                  _MoreReportsTile(
                    icon: Icons.receipt_outlined,
                    color: const Color(0xFF1565C0),
                    title: 'GST Reports',
                    subtitle: 'GSTR-1, GSTR-3B & HSN summary',
                    onTap: () => Navigator.push(context,
                        MaterialPageRoute(builder: (_) => const GstScreen())),
                  ),
                  const SizedBox(height: 16),
                ],
              ),
            ),
    );
  }
}

class _SummaryCards extends StatelessWidget {
  final Map<String, dynamic> summary;
  const _SummaryCards({required this.summary});

  @override
  Widget build(BuildContext context) {
    final cards = [
      ('Total Sales', '₹${_n(summary['totalSales'])}',
          Icons.attach_money, Colors.blue),
      ('Orders', '${sp.i(summary['totalOrders'])}',
          Icons.receipt_long, Colors.purple),
      ('Avg Order', '₹${_n(summary['avgOrderValue'])}',
          Icons.trending_up, Colors.orange),
      ('Items Sold', '${sp.i(summary['totalItemsSold'])}',
          Icons.inventory, Colors.green),
    ];
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisSpacing: 12,
      mainAxisSpacing: 12,
      childAspectRatio: 1.8,
      children: cards.map((c) {
        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: c.$4.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: c.$4.withValues(alpha: 0.3)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(c.$3, color: c.$4, size: 20),
              const SizedBox(height: 4),
              Text(c.$2,
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: c.$4)),
              Text(c.$1,
                  style: const TextStyle(
                      color: Colors.grey, fontSize: 12)),
            ],
          ),
        );
      }).toList(),
    );
  }

  static String _n(dynamic v) => sp.d(v).toStringAsFixed(0);
}

class _DailyTrendChart extends StatelessWidget {
  final List<dynamic> data;
  final DateFormat displayFmt;
  const _DailyTrendChart({required this.data, required this.displayFmt});

  @override
  Widget build(BuildContext context) {
    final spots = data.asMap().entries.map((e) {
      final amount = sp.d(e.value['totalSales']);
      return FlSpot(e.key.toDouble(), amount);
    }).toList();

    final maxY = spots.isEmpty
        ? 1.0
        : spots.map((s) => s.y).reduce((a, b) => a > b ? a : b) * 1.2;

    return SizedBox(
      height: 220,
      child: LineChart(
        LineChartData(
          minY: 0,
          maxY: maxY == 0 ? 1 : maxY,
          gridData: FlGridData(
            show: true,
            drawVerticalLine: false,
            getDrawingHorizontalLine: (v) =>
                const FlLine(color: Color(0xFFEEEEEE), strokeWidth: 1),
          ),
          borderData: FlBorderData(show: false),
          titlesData: FlTitlesData(
            leftTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 48,
                getTitlesWidget: (value, meta) {
                  if (value == 0) return const SizedBox.shrink();
                  return Text(
                    _compact(value),
                    style: const TextStyle(
                        color: Colors.grey, fontSize: 10),
                  );
                },
              ),
            ),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                reservedSize: 28,
                interval: data.length <= 7
                    ? 1
                    : (data.length / 5).ceilToDouble(),
                getTitlesWidget: (value, meta) {
                  final idx = value.toInt();
                  if (idx < 0 || idx >= data.length) {
                    return const SizedBox.shrink();
                  }
                  final dateStr = data[idx]['date'] as String? ?? '';
                  String label = '';
                  try {
                    final dt = DateTime.parse(dateStr);
                    label = displayFmt.format(dt);
                  } catch (_) {
                    label = dateStr.length >= 5 ? dateStr.substring(5) : dateStr;
                  }
                  return Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(label,
                        style: const TextStyle(
                            color: Colors.grey, fontSize: 10)),
                  );
                },
              ),
            ),
            topTitles: const AxisTitles(
                sideTitles: SideTitles(showTitles: false)),
            rightTitles: const AxisTitles(
                sideTitles: SideTitles(showTitles: false)),
          ),
          lineBarsData: [
            LineChartBarData(
              spots: spots,
              isCurved: true,
              color: const Color(0xFF6C63FF),
              barWidth: 3,
              dotData: FlDotData(
                show: data.length <= 14,
                getDotPainter: (spot, _, __, ___) => FlDotCirclePainter(
                  radius: 3,
                  color: const Color(0xFF6C63FF),
                  strokeWidth: 0,
                ),
              ),
              belowBarData: BarAreaData(
                show: true,
                color: const Color(0xFF6C63FF).withValues(alpha: 0.1),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _compact(double v) {
    if (v >= 1000000) return '${(v / 1000000).toStringAsFixed(1)}M';
    if (v >= 1000) return '${(v / 1000).toStringAsFixed(0)}K';
    return v.toStringAsFixed(0);
  }
}

class _TopProductsList extends StatelessWidget {
  final List<dynamic> products;
  const _TopProductsList({required this.products});

  @override
  Widget build(BuildContext context) {
    final maxRevenue = products.isEmpty
        ? 1.0
        : products
            .map((p) => sp.d(p['totalRevenue']))
            .reduce((a, b) => a > b ? a : b);

    return Column(
      children: products.asMap().entries.map((entry) {
        final i = entry.key;
        final p = entry.value;
        final qty = sp.d(p['totalQuantity']);
        final revenue = sp.d(p['totalRevenue']);
        final pct = maxRevenue > 0 ? revenue / maxRevenue : 0.0;

        return Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 24,
                    height: 24,
                    decoration: BoxDecoration(
                      color: _rankColor(i).withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text('${i + 1}',
                          style: TextStyle(
                              color: _rankColor(i),
                              fontWeight: FontWeight.bold,
                              fontSize: 11)),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(p['productName'] ?? '',
                        style: const TextStyle(fontWeight: FontWeight.w500)),
                  ),
                  Text(
                    '₹${revenue.toStringAsFixed(0)}',
                    style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF6C63FF)),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  const SizedBox(width: 34),
                  Expanded(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: LinearProgressIndicator(
                        value: pct.toDouble(),
                        backgroundColor: Colors.grey.shade200,
                        color: _rankColor(i),
                        minHeight: 5,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text('${qty.toStringAsFixed(0)} units',
                      style: const TextStyle(
                          color: Colors.grey, fontSize: 11)),
                ],
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Color _rankColor(int rank) {
    return switch (rank) {
      0 => const Color(0xFFFFD700),
      1 => const Color(0xFFC0C0C0),
      2 => const Color(0xFFCD7F32),
      _ => const Color(0xFF6C63FF),
    };
  }
}

class _MoreReportsTile extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _MoreReportsTile({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: Colors.grey.withValues(alpha: 0.15)),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, color: color, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: const TextStyle(fontWeight: FontWeight.bold)),
                    Text(subtitle,
                        style: const TextStyle(fontSize: 12, color: Colors.grey)),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: Colors.grey.withValues(alpha: 0.6)),
            ],
          ),
        ),
      ),
    );
  }
}
