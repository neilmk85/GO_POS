import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:pos_mobile/main.dart';
import '../../models/models.dart';
import '../../services/api_service.dart';

class SalesOrdersScreen extends StatefulWidget {
  const SalesOrdersScreen({super.key});

  @override
  State<SalesOrdersScreen> createState() => _SalesOrdersScreenState();
}

class _SalesOrdersScreenState extends State<SalesOrdersScreen> {
  final List<SalesOrder> _orders = [];
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
      _orders.clear();
      _page = 0;
      _hasMore = true;
    }
    setState(() => _loading = true);
    try {
      final raw = await ApiService().getSalesOrders(page: _page, size: 20);
      final items = raw.map((e) => SalesOrder.fromJson(e)).toList();
      setState(() {
        _orders.addAll(items);
        _page++;
        _hasMore = items.length == 20;
        _loading = false;
      });
    } catch (e) {
      setState(() => _loading = false);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.menu_outlined),
          onPressed: openAppDrawer,
          tooltip: 'Open menu',
        ),
        title: const Text('Sales Orders'),
        backgroundColor: const Color(0xFF4CAF50),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => _load(reset: true),
          ),
        ],
      ),
      body: _orders.isEmpty && !_loading
          ? _EmptyState(onRefresh: () => _load(reset: true))
          : RefreshIndicator(
              onRefresh: () => _load(reset: true),
              child: ListView.builder(
                controller: _scroll,
                padding: const EdgeInsets.all(12),
                itemCount: _orders.length + (_loading ? 1 : 0),
                itemBuilder: (ctx, i) {
                  if (i >= _orders.length) {
                    return const Center(
                        child: Padding(
                      padding: EdgeInsets.all(16),
                      child: CircularProgressIndicator(),
                    ));
                  }
                  return _SalesOrderCard(
                    order: _orders[i],
                    onStatusChanged: () => _load(reset: true),
                  );
                },
              ),
            ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _showCreateDialog(context),
        backgroundColor: const Color(0xFF4CAF50),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('New Order'),
      ),
    );
  }

  void _showCreateDialog(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _CreateSOSheet(onCreated: () => _load(reset: true)),
    );
  }
}

class _SalesOrderCard extends StatelessWidget {
  final SalesOrder order;
  final VoidCallback onStatusChanged;

  const _SalesOrderCard({required this.order, required this.onStatusChanged});

  static const _statusColors = {
    'PENDING': Color(0xFFFF9800),
    'CONFIRMED': Color(0xFF2196F3),
    'DELIVERED': Color(0xFF4CAF50),
    'CANCELLED': Color(0xFF9E9E9E),
    'PROCESSING': Color(0xFF9C27B0),
  };

  @override
  Widget build(BuildContext context) {
    final color = _statusColors[order.status] ?? const Color(0xFF9E9E9E);
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);

    return Card(
      margin: const EdgeInsets.only(bottom: 10),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: BorderSide(color: Colors.grey.withOpacity(0.15)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => _showDetail(context),
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
                child: Icon(Icons.shopping_bag_outlined, color: color, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(order.soNumber,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                    if (order.customerName != null)
                      Text(order.customerName!,
                          style: TextStyle(
                              fontSize: 12,
                              color: Theme.of(context).colorScheme.onSurface.withOpacity(0.6))),
                    Text(
                        order.createdAt.isNotEmpty
                            ? _formatDate(order.createdAt)
                            : '',
                        style: TextStyle(
                            fontSize: 11,
                            color: Theme.of(context).colorScheme.onSurface.withOpacity(0.4))),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(fmt.format(order.totalAmount),
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                  const SizedBox(height: 4),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: color.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(order.status,
                        style: TextStyle(
                            fontSize: 10, color: color, fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDate(String dateStr) {
    try {
      final d = DateTime.parse(dateStr);
      return DateFormat('dd MMM yyyy').format(d);
    } catch (_) {
      return dateStr;
    }
  }

  void _showDetail(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => _SODetailSheet(order: order, onStatusChanged: onStatusChanged),
    );
  }
}

class _SODetailSheet extends StatelessWidget {
  final SalesOrder order;
  final VoidCallback onStatusChanged;

  const _SODetailSheet({required this.order, required this.onStatusChanged});

  static const _statusColors = {
    'PENDING': Color(0xFFFF9800),
    'CONFIRMED': Color(0xFF2196F3),
    'DELIVERED': Color(0xFF4CAF50),
    'CANCELLED': Color(0xFF9E9E9E),
  };

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2);
    final color = _statusColors[order.status] ?? const Color(0xFF9E9E9E);

    return DraggableScrollableSheet(
      initialChildSize: 0.65,
      maxChildSize: 0.95,
      minChildSize: 0.4,
      expand: false,
      builder: (_, ctrl) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(order.soNumber,
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(order.status,
                      style: TextStyle(color: color, fontWeight: FontWeight.bold)),
                ),
              ],
            ),
            if (order.customerName != null) ...[
              const SizedBox(height: 4),
              Text('Customer: ${order.customerName}',
                  style: const TextStyle(color: Colors.grey)),
            ],
            const Divider(height: 24),
            if (order.items.isNotEmpty) ...[
              const Text('Items', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Expanded(
                child: ListView.builder(
                  controller: ctrl,
                  itemCount: order.items.length,
                  itemBuilder: (_, i) {
                    final item = order.items[i];
                    return ListTile(
                      dense: true,
                      title: Text(item.productName),
                      subtitle: Text('${item.quantity} × ${fmt.format(item.unitPrice)}'),
                      trailing: Text(fmt.format(item.total),
                          style: const TextStyle(fontWeight: FontWeight.bold)),
                    );
                  },
                ),
              ),
            ] else
              const Expanded(child: Center(child: Text('No items loaded'))),
            const Divider(),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Total', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                Text(fmt.format(order.totalAmount),
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              ],
            ),
            const SizedBox(height: 16),
            if (order.status == 'PENDING')
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _doAction(context, 'cancel'),
                      icon: const Icon(Icons.cancel_outlined),
                      label: const Text('Cancel'),
                      style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: () => _doAction(context, 'confirm'),
                      icon: const Icon(Icons.check_circle_outline),
                      label: const Text('Confirm'),
                      style: FilledButton.styleFrom(backgroundColor: const Color(0xFF4CAF50)),
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _doAction(BuildContext context, String action) async {
    Navigator.pop(context);
    try {
      if (action == 'confirm') {
        await ApiService().confirmSalesOrder(order.id);
      } else {
        await ApiService().cancelSalesOrder(order.id);
      }
      onStatusChanged();
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Order ${action}ed successfully')),
        );
      }
    } catch (e) {
      if (context.mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }
}

class _CreateSOSheet extends StatefulWidget {
  final VoidCallback onCreated;
  const _CreateSOSheet({required this.onCreated});

  @override
  State<_CreateSOSheet> createState() => _CreateSOSheetState();
}

class _CreateSOSheetState extends State<_CreateSOSheet> {
  final _customerCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  bool _saving = false;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('New Sales Order',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 16),
          TextField(
            controller: _customerCtrl,
            decoration: const InputDecoration(
              labelText: 'Customer Name',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _notesCtrl,
            decoration: const InputDecoration(
              labelText: 'Notes (optional)',
              border: OutlineInputBorder(),
            ),
            maxLines: 2,
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: _saving ? null : _submit,
              style: FilledButton.styleFrom(backgroundColor: const Color(0xFF4CAF50)),
              child: _saving
                  ? const SizedBox(
                      height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Create Sales Order'),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _submit() async {
    setState(() => _saving = true);
    try {
      await ApiService().createSalesOrder({
        'customerName': _customerCtrl.text.trim(),
        'notes': _notesCtrl.text.trim(),
        'items': [],
      });
      if (mounted) Navigator.pop(context);
      widget.onCreated();
    } catch (e) {
      setState(() => _saving = false);
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Error: $e')));
      }
    }
  }
}

class _EmptyState extends StatelessWidget {
  final VoidCallback onRefresh;
  const _EmptyState({required this.onRefresh});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.shopping_bag_outlined, size: 64, color: Colors.grey),
          const SizedBox(height: 12),
          const Text('No sales orders yet'),
          const SizedBox(height: 12),
          OutlinedButton.icon(
            onPressed: onRefresh,
            icon: const Icon(Icons.refresh),
            label: const Text('Refresh'),
          ),
        ],
      ),
    );
  }
}
