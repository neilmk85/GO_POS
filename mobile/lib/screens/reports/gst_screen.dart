import '../../utils/parse.dart' as sp;
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../services/api_service.dart';

class GstScreen extends StatefulWidget {
  const GstScreen({super.key});

  @override
  State<GstScreen> createState() => _GstScreenState();
}

class _GstScreenState extends State<GstScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabCtrl;
  Map<String, dynamic>? _gstr1;
  Map<String, dynamic>? _gstr3b;
  List<dynamic> _hsnSummary = [];
  bool _loading = true;
  String? _error;
  DateTimeRange _range = DateTimeRange(
    start: DateTime(DateTime.now().year, DateTime.now().month, 1),
    end: DateTime.now(),
  );

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 3, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final from = DateFormat('yyyy-MM-dd').format(_range.start);
      final to = DateFormat('yyyy-MM-dd').format(_range.end);
      final results = await Future.wait([
        ApiService().getGstr1(from, to),
        ApiService().getGstr3b(from, to),
        ApiService().getHsnSummary(from, to),
      ]);
      setState(() {
        _gstr1 = results[0] as Map<String, dynamic>;
        _gstr3b = results[1] as Map<String, dynamic>;
        _hsnSummary = results[2] as List<dynamic>;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _loading = false;
        _error = e.toString();
      });
    }
  }

  Future<void> _pickRange() async {
    final picked = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2020),
      lastDate: DateTime.now(),
      initialDateRange: _range,
    );
    if (picked != null) {
      setState(() => _range = picked);
      _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('GST Reports'),
        backgroundColor: const Color(0xFF1565C0),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.date_range),
            onPressed: _pickRange,
          ),
          IconButton(icon: const Icon(Icons.refresh), onPressed: _load),
        ],
        bottom: TabBar(
          controller: _tabCtrl,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white60,
          indicatorColor: Colors.white,
          tabs: const [
            Tab(text: 'GSTR-1'),
            Tab(text: 'GSTR-3B'),
            Tab(text: 'HSN'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.error_outline, size: 48, color: Colors.red),
                      const SizedBox(height: 12),
                      Text(_error!),
                      const SizedBox(height: 16),
                      FilledButton(onPressed: _load, child: const Text('Retry')),
                    ],
                  ),
                )
              : TabBarView(
                  controller: _tabCtrl,
                  children: [
                    _Gstr1Tab(data: _gstr1 ?? {}),
                    _Gstr3bTab(data: _gstr3b ?? {}),
                    _HsnTab(data: _hsnSummary),
                  ],
                ),
    );
  }
}

class _Gstr1Tab extends StatelessWidget {
  final Map<String, dynamic> data;
  const _Gstr1Tab({required this.data});

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final totalTaxableValue =
        sp.d(data['totalTaxableValue']);
    final totalTax = sp.d(data['totalTax']);
    final totalInvoices = data['totalInvoices'] ?? 0;
    final igst = sp.d(data['totalIgst']);
    final cgst = sp.d(data['totalCgst']);
    final sgst = sp.d(data['totalSgst']);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          _GstSummaryCard(
            title: 'GSTR-1 Summary',
            color: const Color(0xFF1565C0),
            rows: [
              ('Total Invoices', totalInvoices.toString()),
              ('Taxable Value', fmt.format(totalTaxableValue)),
              ('Total Tax', fmt.format(totalTax)),
              ('IGST', fmt.format(igst)),
              ('CGST', fmt.format(cgst)),
              ('SGST', fmt.format(sgst)),
            ],
          ),
          if (data['b2b'] != null || data['b2c'] != null) ...[
            const SizedBox(height: 16),
            _GstSummaryCard(
              title: 'Breakdown',
              color: const Color(0xFF1976D2),
              rows: [
                if (data['b2bTaxableValue'] != null)
                  ('B2B Taxable',
                      fmt.format(sp.d(data['b2bTaxableValue']))),
                if (data['b2cTaxableValue'] != null)
                  ('B2C Taxable',
                      fmt.format(sp.d(data['b2cTaxableValue']))),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _Gstr3bTab extends StatelessWidget {
  final Map<String, dynamic> data;
  const _Gstr3bTab({required this.data});

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final outwardTax = sp.d(data['outwardTaxLiability']);
    final inputCredit = sp.d(data['inputTaxCredit']);
    final netPayable = outwardTax - inputCredit;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          _GstSummaryCard(
            title: 'GSTR-3B Summary',
            color: const Color(0xFF00796B),
            rows: [
              ('Outward Tax Liability', fmt.format(outwardTax)),
              ('Input Tax Credit', fmt.format(inputCredit)),
              ('Net Payable', fmt.format(netPayable)),
            ],
          ),
          const SizedBox(height: 16),
          _GstSummaryCard(
            title: 'Tax Breakup',
            color: const Color(0xFF00897B),
            rows: [
              if (data['igstPayable'] != null)
                ('IGST Payable',
                    fmt.format(sp.d(data['igstPayable']))),
              if (data['cgstPayable'] != null)
                ('CGST Payable',
                    fmt.format(sp.d(data['cgstPayable']))),
              if (data['sgstPayable'] != null)
                ('SGST Payable',
                    fmt.format(sp.d(data['sgstPayable']))),
            ],
          ),
        ],
      ),
    );
  }
}

class _HsnTab extends StatelessWidget {
  final List<dynamic> data;
  const _HsnTab({required this.data});

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    if (data.isEmpty) {
      return const Center(child: Text('No HSN data available'));
    }

    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: data.length,
      itemBuilder: (ctx, i) {
        final item = data[i] as Map<String, dynamic>;
        final taxableVal =
            sp.d(item['taxableValue']);
        final tax = sp.d(item['totalTax']);
        return Card(
          margin: const EdgeInsets.only(bottom: 10),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
            side: BorderSide(color: Colors.grey.withValues(alpha: 0.15)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: const Color(0xFF1565C0).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Center(
                    child: Text(
                      item['hsnCode'] ?? '?',
                      style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 11,
                          color: Color(0xFF1565C0)),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item['description'] ?? item['hsnCode'] ?? '',
                          style: const TextStyle(fontWeight: FontWeight.w600),
                          overflow: TextOverflow.ellipsis),
                      Text(
                          'Qty: ${item['quantity'] ?? '-'} | '
                          'Rate: ${item['taxRate'] ?? '-'}%',
                          style: const TextStyle(
                              fontSize: 12, color: Colors.grey)),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(fmt.format(taxableVal),
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                    Text('Tax: ${fmt.format(tax)}',
                        style: const TextStyle(
                            fontSize: 11, color: Colors.grey)),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _GstSummaryCard extends StatelessWidget {
  final String title;
  final Color color;
  final List<(String, String)> rows;

  const _GstSummaryCard({
    required this.title,
    required this.color,
    required this.rows,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 0,
      color: color.withValues(alpha: 0.06),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: color.withValues(alpha: 0.2)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style: TextStyle(
                    fontWeight: FontWeight.bold, color: color, fontSize: 14)),
            const Divider(height: 20),
            ...rows.map(
              (r) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(r.$1,
                        style: const TextStyle(
                            fontSize: 13, color: Colors.grey)),
                    Text(r.$2,
                        style: const TextStyle(
                            fontSize: 13, fontWeight: FontWeight.bold)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
