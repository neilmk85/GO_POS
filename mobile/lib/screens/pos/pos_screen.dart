import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:pos_mobile/main.dart';
import '../../models/models.dart';
import '../../providers/cart_provider.dart';
import '../../services/api_service.dart';
import 'checkout_sheet.dart';

class POSScreen extends ConsumerStatefulWidget {
  const POSScreen({super.key});

  @override
  ConsumerState<POSScreen> createState() => _POSScreenState();
}

class _POSScreenState extends ConsumerState<POSScreen> {
  final _searchCtrl = TextEditingController();
  List<Product> _searchResults = [];
  bool _searching = false;
  bool _showScanner = false;

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _search(String q) async {
    if (q.isEmpty) {
      setState(() => _searchResults = []);
      return;
    }
    setState(() => _searching = true);
    try {
      final results = await ApiService().searchProducts(q);
      setState(() => _searchResults = results);
    } finally {
      setState(() => _searching = false);
    }
  }

  Future<void> _addProductToCart(Product product) async {
    _searchCtrl.clear();
    setState(() => _searchResults = []);

    // Fetch full product detail with variants
    Product fullProduct = product;
    try {
      fullProduct = await ApiService().getProductDetail(product.id);
    } catch (_) {}

    if (!mounted) return;

    if (fullProduct.variants.isNotEmpty) {
      await _showVariantPicker(fullProduct);
    } else {
      ref.read(cartProvider.notifier).addItem(fullProduct);
    }
  }

  Future<void> _showVariantPicker(Product product) async {
    await showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 20, 16, 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    product.name,
                    style: const TextStyle(
                        fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
            const Text('Select a variant',
                style: TextStyle(color: Colors.grey, fontSize: 13)),
            const SizedBox(height: 12),
            ...product.variants.map(
              (v) => ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(v.name),
                subtitle: v.sku != null ? Text('SKU: ${v.sku}') : null,
                trailing: Text(
                  '₹${v.price.toStringAsFixed(2)}',
                  style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF6C63FF),
                      fontSize: 15),
                ),
                onTap: () {
                  ref
                      .read(cartProvider.notifier)
                      .addItem(product, variant: v);
                  Navigator.pop(ctx);
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _onBarcode(String barcode) async {
    setState(() => _showScanner = false);
    try {
      final product = await ApiService().getProductByBarcode(barcode);
      if (product != null) {
        await _addProductToCart(product);
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Product not found: $barcode')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(cartProvider);
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.menu_outlined),
          onPressed: openAppDrawer,
          tooltip: 'Open menu',
        ),
        title: const Text('POS'),
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code_scanner),
            onPressed: () => setState(() => _showScanner = !_showScanner),
          ),
        ],
      ),
      body: Column(
        children: [
          if (_showScanner)
            SizedBox(
              height: 200,
              child: MobileScanner(
                onDetect: (capture) {
                  final barcode = capture.barcodes.firstOrNull?.rawValue;
                  if (barcode != null) _onBarcode(barcode);
                },
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: TextField(
              controller: _searchCtrl,
              decoration: InputDecoration(
                hintText: 'Search products...',
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
          if (_searchResults.isNotEmpty)
            Container(
              height: 200,
              margin: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                color: Theme.of(context).cardColor,
                borderRadius: BorderRadius.circular(12),
                boxShadow: [
                  BoxShadow(blurRadius: 8, color: Colors.black26)
                ],
              ),
              child: ListView.builder(
                itemCount: _searchResults.length,
                itemBuilder: (ctx, i) {
                  final p = _searchResults[i];
                  return ListTile(
                    title: Text(p.name),
                    subtitle: Text('₹${p.sellingPrice.toStringAsFixed(2)}'),
                    trailing: IconButton(
                      icon: const Icon(Icons.add_circle,
                          color: Color(0xFF6C63FF)),
                      onPressed: () => _addProductToCart(p),
                    ),
                  );
                },
              ),
            ),
          Expanded(
            child: cart.items.isEmpty
                ? const Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.shopping_cart_outlined,
                            size: 64, color: Colors.grey),
                        SizedBox(height: 12),
                        Text('Cart is empty',
                            style: TextStyle(color: Colors.grey)),
                      ],
                    ),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    itemCount: cart.items.length,
                    itemBuilder: (ctx, i) => _CartItemTile(
                      item: cart.items[i],
                      onIncrease: () => ref
                          .read(cartProvider.notifier)
                          .updateQuantity(i, cart.items[i].quantity + 1),
                      onDecrease: () => ref
                          .read(cartProvider.notifier)
                          .updateQuantity(i, cart.items[i].quantity - 1),
                      onRemove: () =>
                          ref.read(cartProvider.notifier).removeItem(i),
                      onSetDiscount: (pct) =>
                          ref.read(cartProvider.notifier).setDiscount(i, pct),
                    ),
                  ),
          ),
          _CartSummary(cart: cart),
        ],
      ),
    );
  }
}

class _CartItemTile extends StatelessWidget {
  final CartItem item;
  final VoidCallback onIncrease;
  final VoidCallback onDecrease;
  final VoidCallback onRemove;
  final ValueChanged<double> onSetDiscount;

  const _CartItemTile({
    required this.item,
    required this.onIncrease,
    required this.onDecrease,
    required this.onRemove,
    required this.onSetDiscount,
  });

  void _showDiscountDialog(BuildContext context) {
    final ctrl =
        TextEditingController(text: item.discountPercent.toStringAsFixed(0));
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Item Discount'),
        content: TextField(
          controller: ctrl,
          keyboardType:
              const TextInputType.numberWithOptions(decimal: true),
          decoration: const InputDecoration(
            labelText: 'Discount %',
            border: OutlineInputBorder(),
            suffixText: '%',
          ),
          autofocus: true,
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              final v = double.tryParse(ctrl.text) ?? 0;
              onSetDiscount(v.clamp(0, 100));
              Navigator.pop(ctx);
            },
            child: const Text('Apply'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.productName,
                          style: const TextStyle(fontWeight: FontWeight.w600)),
                      Row(
                        children: [
                          Text('₹${item.unitPrice.toStringAsFixed(2)}',
                              style: const TextStyle(
                                  color: Colors.grey, fontSize: 12)),
                          if (item.discountPercent > 0) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 1),
                              decoration: BoxDecoration(
                                color: Colors.green.shade50,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                '-${item.discountPercent.toStringAsFixed(0)}%',
                                style: TextStyle(
                                    color: Colors.green.shade700,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                        icon: const Icon(Icons.remove_circle_outline),
                        onPressed: onDecrease,
                        iconSize: 20),
                    Text('${item.quantity}',
                        style: const TextStyle(fontWeight: FontWeight.bold)),
                    IconButton(
                        icon: const Icon(Icons.add_circle_outline),
                        onPressed: onIncrease,
                        iconSize: 20),
                  ],
                ),
                SizedBox(
                  width: 80,
                  child: Text(
                    '₹${item.total.toStringAsFixed(2)}',
                    textAlign: TextAlign.end,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton.icon(
                  icon: const Icon(Icons.discount_outlined, size: 14),
                  label: Text(
                    item.discountPercent > 0 ? 'Edit Discount' : 'Add Discount',
                    style: const TextStyle(fontSize: 12),
                  ),
                  style: TextButton.styleFrom(
                    foregroundColor: Colors.orange.shade700,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 0),
                    minimumSize: Size.zero,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  onPressed: () => _showDiscountDialog(context),
                ),
                const SizedBox(width: 4),
                IconButton(
                    icon: const Icon(Icons.delete_outline, color: Colors.red),
                    iconSize: 18,
                    onPressed: onRemove),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _CartSummary extends ConsumerWidget {
  final CartState cart;
  const _CartSummary({required this.cart});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (cart.items.isEmpty) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Theme.of(context).cardColor,
        boxShadow: [
          BoxShadow(
              blurRadius: 10,
              color: Colors.black26,
              offset: const Offset(0, -2))
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _Row('Subtotal', cart.subtotal),
          if (cart.totalDiscount > 0)
            _Row('Discount', -cart.totalDiscount, color: Colors.green),
          _Row('Tax', cart.totalTax),
          const Divider(),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Total',
                  style:
                      TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              Text('₹${cart.grandTotal.toStringAsFixed(2)}',
                  style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF6C63FF))),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => showModalBottomSheet(
                context: context,
                isScrollControlled: true,
                builder: (_) => const CheckoutSheet(),
              ),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF6C63FF),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
              ),
              child: Text(
                'Checkout  •  ${cart.itemCount} items',
                style: const TextStyle(fontSize: 16, color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _Row(String label, double amount, {Color? color}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: TextStyle(color: color ?? Colors.grey)),
            Text(
              '₹${amount.abs().toStringAsFixed(2)}',
              style: TextStyle(color: color),
            ),
          ],
        ),
      );
}
