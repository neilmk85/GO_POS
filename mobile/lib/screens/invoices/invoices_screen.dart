import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:pos_mobile/main.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';

class InvoicesScreen extends StatefulWidget {
  const InvoicesScreen({super.key});

  @override
  State<InvoicesScreen> createState() => _InvoicesScreenState();
}

class _InvoicesScreenState extends State<InvoicesScreen> {
  final List<Invoice> _invoices = [];
  bool _loading = false;
  bool _hasMore = true;
  int _page = 0;
  final _scroll = ScrollController();

  @override
  void initState() {
    super.initState();
    _load();
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 200) {
        if (!_loading && _hasMore) _load();
      }
    });
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _load({bool reset = false}) async {
    if (_loading) return;
    if (reset) {
      _invoices.clear();
      _page = 0;
      _hasMore = true;
    }
    setState(() => _loading = true);
    try {
      final raw = await ApiService().getInvoices(page: _page, size: 20);
      final items = raw.map((e) => Invoice.fromJson(e)).toList();
      setState(() {
        _invoices.addAll(items);
        _page++;
        _hasMore = items.length == 20;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.menu_outlined),
          onPressed: openAppDrawer,
          tooltip: 'Open menu',
        ),
        title: const Text('Invoices'),
        backgroundColor: const Color(0xFF2196F3),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => _load(reset: true),
          ),
        ],
      ),
      body: _invoices.isEmpty && !_loading
          ? const Center(child: Text('No invoices found'))
          : RefreshIndicator(
              onRefresh: () => _load(reset: true),
              child: ListView.builder(
                controller: _scroll,
                padding: const EdgeInsets.all(12),
                itemCount: _invoices.length + (_loading ? 1 : 0),
                itemBuilder: (ctx, i) {
                  if (i >= _invoices.length) {
                    return const Center(
                        child: Padding(
                      padding: EdgeInsets.all(16),
                      child: CircularProgressIndicator(),
                    ));
                  }
                  final inv = _invoices[i];
                  final isPaid = inv.status == 'PAID' || inv.balanceDue <= 0;
                  final color = isPaid ? const Color(0xFF4CAF50) : const Color(0xFFFF9800);

                  return Card(
                    margin: const EdgeInsets.only(bottom: 10),
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                      side: BorderSide(color: Colors.grey.withOpacity(0.15)),
                    ),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(14),
                      onTap: () => _showDetail(context, inv),
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Row(
                          children: [
                            Container(
                              width: 42,
                              height: 42,
                              decoration: BoxDecoration(
                                color: color.withOpacity(0.12),
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: Icon(Icons.description_outlined, color: color, size: 22),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(inv.invoiceNumber,
                                      style: const TextStyle(
                                          fontWeight: FontWeight.bold, fontSize: 14)),
                                  if (inv.customerName != null)
                                    Text(inv.customerName!,
                                        style: TextStyle(
                                            fontSize: 12,
                                            color: Theme.of(context)
                                                .colorScheme
                                                .onSurface
                                                .withOpacity(0.6))),
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(fmt.format(inv.totalAmount),
                                    style: const TextStyle(
                                        fontWeight: FontWeight.bold, fontSize: 14)),
                                const SizedBox(height: 4),
                                if (!isPaid)
                                  Text('Due: ${fmt.format(inv.balanceDue)}',
                                      style: const TextStyle(
                                          fontSize: 11, color: Color(0xFFFF9800))),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 8, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: color.withOpacity(0.12),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(isPaid ? 'PAID' : inv.status,
                                      style: TextStyle(
                                          fontSize: 10,
                                          color: color,
                                          fontWeight: FontWeight.bold)),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
    );
  }

  void _showDetail(BuildContext context, Invoice inv) {
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2);
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => DraggableScrollableSheet(
        initialChildSize: 0.6,
        maxChildSize: 0.9,
        expand: false,
        builder: (_, ctrl) => Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(inv.invoiceNumber,
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              if (inv.customerName != null)
                Text(inv.customerName!, style: const TextStyle(color: Colors.grey)),
              const Divider(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Total Amount'),
                  Text(fmt.format(inv.totalAmount),
                      style: const TextStyle(fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Paid'),
                  Text(fmt.format(inv.paidAmount),
                      style: const TextStyle(color: Color(0xFF4CAF50))),
                ],
              ),
              const SizedBox(height: 4),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Balance Due',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                  Text(fmt.format(inv.balanceDue),
                      style: const TextStyle(
                          fontWeight: FontWeight.bold, color: Color(0xFFFF9800))),
                ],
              ),
              const Divider(height: 24),
              if (inv.items.isNotEmpty) ...[
                const Text('Items', style: TextStyle(fontWeight: FontWeight.bold)),
                Expanded(
                  child: ListView.builder(
                    controller: ctrl,
                    itemCount: inv.items.length,
                    itemBuilder: (_, i) {
                      final item = inv.items[i];
                      return ListTile(
                        dense: true,
                        title: Text(item.productName),
                        subtitle: Text('${item.quantity} × ${fmt.format(item.unitPrice)}'),
                        trailing: Text(fmt.format(item.total)),
                      );
                    },
                  ),
                ),
              ] else
                const Expanded(child: Center(child: Text('No items'))),
            ],
          ),
        ),
      ),
    );
  }
}
