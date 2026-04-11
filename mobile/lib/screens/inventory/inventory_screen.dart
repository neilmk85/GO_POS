import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
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
    _tabs = TabController(length: 2, vsync: this);
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
        title: const Text('Inventory'),
        bottom: TabBar(
          controller: _tabs,
          tabs: const [
            Tab(text: 'Low Stock'),
            Tab(text: 'Search Outlets'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: const [
          _LowStockTab(),
          _CrossOutletTab(),
        ],
      ),
    );
  }
}

class _LowStockTab extends ConsumerWidget {
  const _LowStockTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_lowStockProvider);
    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Error: $e')),
      data: (items) => items.isEmpty
          ? const Center(child: Text('No low stock items'))
          : ListView.builder(
              itemCount: items.length,
              itemBuilder: (ctx, i) {
                final inv = items[i];
                return ListTile(
                  title: Text(inv.product.name),
                  subtitle: Text(inv.product.sku ?? ''),
                  trailing: _StockBadge(qty: inv.quantityOnHand, reorder: inv.reorderLevel.toDouble()),
                );
              },
            ),
    );
  }
}

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
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
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
                      padding: const EdgeInsets.only(left: 16, right: 16, bottom: 8),
                      child: Wrap(
                        spacing: 8,
                        children: stockData.map((s) {
                          final qty = (s['quantityOnHand'] as num).toDouble();
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
