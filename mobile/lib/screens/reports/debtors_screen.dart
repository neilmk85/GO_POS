import '../../utils/parse.dart' as p;
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../services/api_service.dart';

class DebtorsScreen extends StatefulWidget {
  const DebtorsScreen({super.key});

  @override
  State<DebtorsScreen> createState() => _DebtorsScreenState();
}

class _DebtorsScreenState extends State<DebtorsScreen> {
  List<dynamic> _items = [];
  bool _loading = true;
  String? _error;
  DateTimeRange _range = DateTimeRange(
    start: DateTime.now().subtract(const Duration(days: 30)),
    end: DateTime.now(),
  );

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final from = DateFormat('yyyy-MM-dd').format(_range.start);
      final to = DateFormat('yyyy-MM-dd').format(_range.end);
      final data = await ApiService().getDebtorsLedger(from, to);
      setState(() {
        _items = data;
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
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final totalDue = _items.fold<double>(
      0,
      (sum, item) =>
          sum + (p.d(item['outstandingAmount'])),
    );

    return Scaffold(
      appBar: AppBar(
        title: const Text('Debtors Ledger'),
        backgroundColor: const Color(0xFFE53935),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.date_range),
            onPressed: _pickRange,
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _load,
          ),
        ],
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
              : Column(
                  children: [
                    _SummaryBanner(
                      label: 'Total Receivable',
                      amount: totalDue,
                      color: const Color(0xFFE53935),
                      count: _items.length,
                      dateRange:
                          '${DateFormat('dd MMM').format(_range.start)} – ${DateFormat('dd MMM yyyy').format(_range.end)}',
                    ),
                    Expanded(
                      child: _items.isEmpty
                          ? const Center(child: Text('No debtors in this period'))
                          : ListView.builder(
                              padding: const EdgeInsets.all(12),
                              itemCount: _items.length,
                              itemBuilder: (ctx, i) {
                                final item =
                                    _items[i] as Map<String, dynamic>;
                                final due =
                                    p.d(item['outstandingAmount']);
                                return _LedgerCard(
                                  name: item['customerName'] ??
                                      item['name'] ??
                                      'Unknown',
                                  phone: item['phone'],
                                  amount: due,
                                  fmt: fmt,
                                  color: const Color(0xFFE53935),
                                  label: 'Receivable',
                                );
                              },
                            ),
                    ),
                  ],
                ),
    );
  }
}

class CreditorScreen extends StatefulWidget {
  const CreditorScreen({super.key});

  @override
  State<CreditorScreen> createState() => _CreditorScreenState();
}

class _CreditorScreenState extends State<CreditorScreen> {
  List<dynamic> _items = [];
  bool _loading = true;
  String? _error;
  DateTimeRange _range = DateTimeRange(
    start: DateTime.now().subtract(const Duration(days: 30)),
    end: DateTime.now(),
  );

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final from = DateFormat('yyyy-MM-dd').format(_range.start);
      final to = DateFormat('yyyy-MM-dd').format(_range.end);
      final data = await ApiService().getCreditorsLedger(from, to);
      setState(() {
        _items = data;
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
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    final totalDue = _items.fold<double>(
      0,
      (sum, item) =>
          sum + (p.d(item['outstandingAmount'])),
    );

    return Scaffold(
      appBar: AppBar(
        title: const Text('Creditors Ledger'),
        backgroundColor: const Color(0xFF5E35B1),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.date_range),
            onPressed: _pickRange,
          ),
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _load,
          ),
        ],
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
              : Column(
                  children: [
                    _SummaryBanner(
                      label: 'Total Payable',
                      amount: totalDue,
                      color: const Color(0xFF5E35B1),
                      count: _items.length,
                      dateRange:
                          '${DateFormat('dd MMM').format(_range.start)} – ${DateFormat('dd MMM yyyy').format(_range.end)}',
                    ),
                    Expanded(
                      child: _items.isEmpty
                          ? const Center(child: Text('No creditors in this period'))
                          : ListView.builder(
                              padding: const EdgeInsets.all(12),
                              itemCount: _items.length,
                              itemBuilder: (ctx, i) {
                                final item =
                                    _items[i] as Map<String, dynamic>;
                                final due =
                                    p.d(item['outstandingAmount']);
                                return _LedgerCard(
                                  name: item['vendorName'] ??
                                      item['name'] ??
                                      'Unknown',
                                  phone: item['phone'],
                                  amount: due,
                                  fmt: fmt,
                                  color: const Color(0xFF5E35B1),
                                  label: 'Payable',
                                );
                              },
                            ),
                    ),
                  ],
                ),
    );
  }
}

// ---- Shared widgets ----

class _SummaryBanner extends StatelessWidget {
  final String label;
  final double amount;
  final Color color;
  final int count;
  final String dateRange;

  const _SummaryBanner({
    required this.label,
    required this.amount,
    required this.color,
    required this.count,
    required this.dateRange,
  });

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    return Container(
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label,
                    style: const TextStyle(
                        fontSize: 12, color: Colors.grey)),
                Text(fmt.format(amount),
                    style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: color)),
                Text('$count parties · $dateRange',
                    style: const TextStyle(fontSize: 11, color: Colors.grey)),
              ],
            ),
          ),
          Icon(Icons.account_balance_wallet_outlined,
              size: 40, color: color.withValues(alpha: 0.4)),
        ],
      ),
    );
  }
}

class _LedgerCard extends StatelessWidget {
  final String name;
  final String? phone;
  final double amount;
  final NumberFormat fmt;
  final Color color;
  final String label;

  const _LedgerCard({
    required this.name,
    this.phone,
    required this.amount,
    required this.fmt,
    required this.color,
    required this.label,
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
      child: ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        leading: CircleAvatar(
          backgroundColor: color.withValues(alpha: 0.1),
          child: Text(
            name.isNotEmpty ? name[0].toUpperCase() : '?',
            style: TextStyle(color: color, fontWeight: FontWeight.bold),
          ),
        ),
        title: Text(name, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: phone != null ? Text(phone!) : null,
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(fmt.format(amount),
                style: TextStyle(
                    fontWeight: FontWeight.bold, color: color, fontSize: 14)),
            Text(label,
                style: const TextStyle(fontSize: 10, color: Colors.grey)),
          ],
        ),
      ),
    );
  }
}
