import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';

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

  final _fmt = DateFormat('yyyy-MM-dd');

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Reports'),
        actions: [
          TextButton.icon(
            icon: const Icon(Icons.calendar_today, size: 16),
            label: Text(
              '${_fmt.format(_from)} – ${_fmt.format(_to)}',
              style: const TextStyle(fontSize: 12),
            ),
            onPressed: _pickRange,
          ),
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
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
                    _DailyTrendChart(data: _dailyTrend),
                    const SizedBox(height: 24),
                  ],
                  if (_topProducts.isNotEmpty) ...[
                    const Text('Top Products',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 12),
                    _TopProductsList(products: _topProducts),
                  ],
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
      ('Total Sales', '₹${_n(summary['totalSales'])}', Icons.attach_money, Colors.blue),
      ('Orders', '${summary['totalOrders'] ?? 0}', Icons.receipt_long, Colors.purple),
      ('Avg Order', '₹${_n(summary['avgOrderValue'])}', Icons.trending_up, Colors.orange),
      ('Items Sold', '${summary['totalItemsSold'] ?? 0}', Icons.inventory, Colors.green),
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
                  style: const TextStyle(color: Colors.grey, fontSize: 12)),
            ],
          ),
        );
      }).toList(),
    );
  }

  String _n(dynamic v) {
    if (v == null) return '0';
    return (v as num).toStringAsFixed(0);
  }
}

class _DailyTrendChart extends StatelessWidget {
  final List<dynamic> data;
  const _DailyTrendChart({required this.data});

  @override
  Widget build(BuildContext context) {
    final spots = data.asMap().entries.map((e) {
      final amount = (e.value['totalSales'] as num?)?.toDouble() ?? 0;
      return FlSpot(e.key.toDouble(), amount);
    }).toList();

    return SizedBox(
      height: 200,
      child: LineChart(
        LineChartData(
          gridData: const FlGridData(show: false),
          titlesData: const FlTitlesData(show: false),
          borderData: FlBorderData(show: false),
          lineBarsData: [
            LineChartBarData(
              spots: spots,
              isCurved: true,
              color: const Color(0xFF6C63FF),
              barWidth: 3,
              dotData: const FlDotData(show: false),
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
}

class _TopProductsList extends StatelessWidget {
  final List<dynamic> products;
  const _TopProductsList({required this.products});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: products.take(5).map((p) {
        final qty = (p['totalQuantity'] as num?)?.toDouble() ?? 0;
        final revenue = (p['totalRevenue'] as num?)?.toDouble() ?? 0;
        return ListTile(
          contentPadding: EdgeInsets.zero,
          title: Text(p['productName'] ?? ''),
          subtitle: Text('${qty.toStringAsFixed(0)} units sold'),
          trailing: Text(
            '₹${revenue.toStringAsFixed(0)}',
            style: const TextStyle(
                fontWeight: FontWeight.bold, color: Color(0xFF6C63FF)),
          ),
        );
      }).toList(),
    );
  }
}
