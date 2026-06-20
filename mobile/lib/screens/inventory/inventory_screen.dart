import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:pos_mobile/main.dart';
import '../../models/models.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';

final _lowStockProvider = FutureProvider<List<Inventory>>((ref) async {
  final outletId = ref.watch(authProvider).user?.outletId;
  if (outletId == null) return [];
  return ApiService().getLowStock(outletId);
});

class InventoryScreen extends ConsumerStatefulWidget {
  const InventoryScreen({super.key});

  @override
  ConsumerState<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends ConsumerState<InventoryScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
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
        title: const Text('Inventory'),
        bottom: TabBar(
          controller: _tabs,
          tabs: const [
            Tab(text: 'Low Stock'),
            Tab(text: 'Adjust Stock'),
            Tab(text: 'Search Outlets'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: const [
          _LowStockTab(),
          _AdjustStockTab(),
          _CrossOutletTab(),
        ],
      ),
    );
  }
}

// ─── Low Stock Tab ───────────────────────────────────────────────────────────

class _LowStockTab extends ConsumerWidget {
  const _LowStockTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_lowStockProvider);
    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e')),
      data: (items) => items.isEmpty
          ? const Center(child: Text('No low stock items 🎉'))
          : ListView.builder(
              itemCount: items.length,
              itemBuilder: (ctx, i) {
                final inv = items[i];
                return ListTile(
                  title: Text(inv.product.name),
                  subtitle: Text(
                      '${inv.product.sku ?? ''}  •  Reorder at: ${inv.reorderLevel}'),
                  trailing: _StockBadge(
                      qty: inv.quantityOnHand,
                      reorder: inv.reorderLevel.toDouble()),
                );
              },
            ),
    );
  }
}

// ─── Adjust Stock Tab ────────────────────────────────────────────────────────

class _AdjustStockTab extends ConsumerStatefulWidget {
  const _AdjustStockTab();

  @override
  ConsumerState<_AdjustStockTab> createState() => _AdjustStockTabState();
}

class _AdjustStockTabState extends ConsumerState<_AdjustStockTab> {
  final _searchCtrl = TextEditingController();
  List<Product> _results = [];
  bool _searching = false;

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _search(String q) async {
    if (q.isEmpty) {
      setState(() => _results = []);
      return;
    }
    setState(() => _searching = true);
    try {
      final r = await ApiService().searchProducts(q);
      setState(() => _results = r);
    } finally {
      setState(() => _searching = false);
    }
  }

  Future<void> _adjust(Product product) async {
    final outletId = ref.read(authProvider).user?.outletId;
    if (outletId == null) return;

    await showDialog(
      context: context,
      builder: (_) =>
          _AdjustmentDialog(product: product, outletId: outletId),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            controller: _searchCtrl,
            decoration: InputDecoration(
              hintText: 'Search product to adjust...',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: _searching
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : null,
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
            onChanged: _search,
          ),
        ),
        if (_results.isEmpty && _searchCtrl.text.isEmpty)
          const Expanded(
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.tune, size: 48, color: Colors.grey),
                  SizedBox(height: 8),
                  Text('Search a product to adjust stock',
                      style: TextStyle(color: Colors.grey)),
                ],
              ),
            ),
          )
        else
          Expanded(
            child: ListView.builder(
              itemCount: _results.length,
              itemBuilder: (ctx, i) {
                final p = _results[i];
                return ListTile(
                  title: Text(p.name),
                  subtitle: Text(p.sku ?? ''),
                  trailing: ElevatedButton.icon(
                    icon: const Icon(Icons.edit, size: 16),
                    label: const Text('Adjust'),
                    onPressed: () => _adjust(p),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF6C63FF),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(
                          horizontal: 12, vertical: 6),
                      minimumSize: Size.zero,
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                  ),
                );
              },
            ),
          ),
      ],
    );
  }
}

class _AdjustmentDialog extends StatefulWidget {
  final Product product;
  final int outletId;
  const _AdjustmentDialog(
      {required this.product, required this.outletId});

  @override
  State<_AdjustmentDialog> createState() => _AdjustmentDialogState();
}

class _AdjustmentDialogState extends State<_AdjustmentDialog> {
  final _qtyCtrl = TextEditingController();
  final _reasonCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  bool _saving = false;

  // positive = stock in, negative = stock out
  bool _isAddition = true;

  @override
  void dispose() {
    _qtyCtrl.dispose();
    _reasonCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final qty = double.tryParse(_qtyCtrl.text);
    if (qty == null || qty <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Enter a valid quantity')));
      return;
    }
    if (_reasonCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Reason is required')));
      return;
    }

    setState(() => _saving = true);
    try {
      final adjustedQty = _isAddition ? qty : -qty;
      await ApiService().adjustStock({
        'productId': widget.product.id,
        'outletId': widget.outletId,
        'quantity': adjustedQty,
        'reason': _reasonCtrl.text.trim(),
        'notes': _notesCtrl.text.trim().isEmpty
            ? null
            : _notesCtrl.text.trim(),
      });
      if (mounted) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
                'Stock ${_isAddition ? 'added' : 'removed'}: $qty ${widget.product.unitOfMeasure}'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text('Adjust Stock\n${widget.product.name}',
          style: const TextStyle(fontSize: 16)),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Add / Remove toggle
            SegmentedButton<bool>(
              segments: const [
                ButtonSegment(
                    value: true,
                    label: Text('Add Stock'),
                    icon: Icon(Icons.add)),
                ButtonSegment(
                    value: false,
                    label: Text('Remove Stock'),
                    icon: Icon(Icons.remove)),
              ],
              selected: {_isAddition},
              onSelectionChanged: (s) =>
                  setState(() => _isAddition = s.first),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _qtyCtrl,
              keyboardType:
                  const TextInputType.numberWithOptions(decimal: true),
              decoration: InputDecoration(
                labelText: 'Quantity *',
                border: const OutlineInputBorder(),
                suffixText: widget.product.unitOfMeasure,
              ),
              autofocus: true,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _reasonCtrl,
              decoration: const InputDecoration(
                labelText: 'Reason *',
                hintText: 'e.g. Goods received, Damage, Count correction',
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
          ],
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel')),
        ElevatedButton(
          onPressed: _saving ? null : _save,
          style: ElevatedButton.styleFrom(
            backgroundColor:
                _isAddition ? Colors.green : Colors.orange,
            foregroundColor: Colors.white,
          ),
          child: _saving
              ? const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(
                      strokeWidth: 2, color: Colors.white))
              : Text(_isAddition ? 'Add Stock' : 'Remove Stock'),
        ),
      ],
    );
  }
}

// ─── Cross Outlet Tab ────────────────────────────────────────────────────────

class _CrossOutletTab extends StatefulWidget {
  const _CrossOutletTab();

  @override
  State<_CrossOutletTab> createState() => _CrossOutletTabState();
}

class _CrossOutletTabState extends State<_CrossOutletTab> {
  final _searchCtrl = TextEditingController();
  List<Product> _results = [];
  bool _searching = false;
  Map<int, List<dynamic>> _stockMap = {};

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _search(String q) async {
    if (q.isEmpty) {
      setState(() => _results = []);
      return;
    }
    setState(() => _searching = true);
    try {
      final r = await ApiService().searchProducts(q);
      setState(() => _results = r);
    } finally {
      setState(() => _searching = false);
    }
  }

  Future<void> _loadStock(int productId) async {
    if (_stockMap.containsKey(productId)) {
      setState(() => _stockMap.remove(productId));
      return;
    }
    final data = await ApiService().getStockAcrossOutlets(productId);
    setState(() => _stockMap[productId] = data);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: TextField(
            controller: _searchCtrl,
            decoration: InputDecoration(
              hintText: 'Search product across outlets...',
              prefixIcon: const Icon(Icons.search),
              suffixIcon: _searching
                  ? const Padding(
                      padding: EdgeInsets.all(12),
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : null,
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12)),
            ),
            onChanged: _search,
          ),
        ),
        Expanded(
          child: ListView.builder(
            itemCount: _results.length,
            itemBuilder: (ctx, i) {
              final p = _results[i];
              final stockData = _stockMap[p.id];
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ListTile(
                    title: Text(p.name),
                    subtitle: Text(p.sku ?? ''),
                    trailing: IconButton(
                      icon: Icon(
                        stockData != null
                            ? Icons.expand_less
                            : Icons.store_outlined,
                        color: const Color(0xFF6C63FF),
                      ),
                      onPressed: () => _loadStock(p.id),
                    ),
                  ),
                  if (stockData != null)
                    Padding(
                      padding: const EdgeInsets.only(
                          left: 16, right: 16, bottom: 8),
                      child: Wrap(
                        spacing: 8,
                        children: stockData.map((s) {
                          final qty =
                              (s['quantityOnHand'] as num).toDouble();
                          return Chip(
                            label: Text(
                              '${s['outletName']}: ${qty.toStringAsFixed(0)}',
                              style: const TextStyle(fontSize: 12),
                            ),
                            backgroundColor: qty > 0
                                ? Colors.green.shade100
                                : Colors.red.shade100,
                          );
                        }).toList(),
                      ),
                    ),
                ],
              );
            },
          ),
        ),
      ],
    );
  }
}

class _StockBadge extends StatelessWidget {
  final double qty;
  final double reorder;
  const _StockBadge({required this.qty, required this.reorder});

  @override
  Widget build(BuildContext context) {
    final isLow = qty <= reorder;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      decoration: BoxDecoration(
        color: isLow ? Colors.red.shade100 : Colors.green.shade100,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        qty.toStringAsFixed(0),
        style: TextStyle(
          color: isLow ? Colors.red : Colors.green,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}
