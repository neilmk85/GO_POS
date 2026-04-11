import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../providers/cart_provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';

class CheckoutSheet extends ConsumerStatefulWidget {
  const CheckoutSheet({super.key});

  @override
  ConsumerState<CheckoutSheet> createState() => _CheckoutSheetState();
}

class _CheckoutSheetState extends ConsumerState<CheckoutSheet> {
  String _paymentMethod = 'CASH';
  final _amountCtrl = TextEditingController();
  bool _sendEmail = false;
  bool _sendSms = false;
  bool _sendWhatsApp = false;
  bool _processing = false;
  final _couponCtrl = TextEditingController();

  @override
  void dispose() {
    _amountCtrl.dispose();
    _couponCtrl.dispose();
    super.dispose();
  }

  double get _grandTotal => ref.read(cartProvider).grandTotal;

  double get _change {
    final entered = double.tryParse(_amountCtrl.text) ?? 0;
    return entered - _grandTotal;
  }

  Future<void> _placeOrder() async {
    final cart = ref.read(cartProvider);
    if (cart.items.isEmpty) return;
    setState(() => _processing = true);
    try {
      final auth = ref.read(authProvider).user!;
      final orderItems = cart.items
          .map((i) => {
                'productId': i.productId,
                if (i.variantId != null) 'variantId': i.variantId,
                'quantity': i.quantity,
                'unitPrice': i.unitPrice,
                'discountPercent': i.discountPercent,
              })
          .toList();

      await ApiService().checkout({
        'outletId': auth.outletId,
        'customerId': cart.customer?.id,
        'items': orderItems,
        'couponCode': cart.couponCode,
        'loyaltyPointsToRedeem': cart.loyaltyPointsRedeemed,
        'payments': [
          {'paymentMethod': _paymentMethod, 'amount': _grandTotal}
        ],
        'sendEmail': _sendEmail,
        'sendSms': _sendSms,
        'sendWhatsApp': _sendWhatsApp,
      });

      ref.read(cartProvider.notifier).clear();
      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Order placed successfully!'),
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
      setState(() => _processing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(cartProvider);
    final bottom = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + bottom),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Text('Checkout',
                    style:
                        TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
                const Spacer(),
                IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop()),
              ],
            ),
            // Customer
            if (cart.customer != null) ...[
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.person, color: Color(0xFF6C63FF)),
                title: Text(cart.customer!.name),
                subtitle: Text('Points: ${cart.customer!.loyaltyPoints.toStringAsFixed(0)}'),
                trailing: TextButton(
                  onPressed: () =>
                      ref.read(cartProvider.notifier).setCustomer(null),
                  child: const Text('Remove'),
                ),
              ),
              const Divider(),
            ],
            // Coupon
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _couponCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Coupon Code',
                      border: OutlineInputBorder(),
                      isDense: true,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                OutlinedButton(
                  onPressed: () async {
                    final code = _couponCtrl.text.trim();
                    if (code.isEmpty) return;
                    try {
                      final result = await ApiService()
                          .validateCoupon(code, cart.grandTotal);
                      ref.read(cartProvider.notifier).applyCoupon(
                            code,
                            (result['discountAmount'] as num).toDouble(),
                          );
                      _couponCtrl.clear();
                    } catch (e) {
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(e.toString())));
                      }
                    }
                  },
                  child: const Text('Apply'),
                ),
              ],
            ),
            const SizedBox(height: 16),
            // Payment method
            const Text('Payment Method',
                style: TextStyle(fontWeight: FontWeight.w600)),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              children: ['CASH', 'CARD', 'UPI', 'CREDIT_NOTE'].map((m) {
                return ChoiceChip(
                  label: Text(m),
                  selected: _paymentMethod == m,
                  onSelected: (_) => setState(() => _paymentMethod = m),
                  selectedColor: const Color(0xFF6C63FF),
                  labelStyle: TextStyle(
                    color: _paymentMethod == m ? Colors.white : null,
                  ),
                );
              }).toList(),
            ),
            if (_paymentMethod == 'CASH') ...[
              const SizedBox(height: 12),
              TextField(
                controller: _amountCtrl,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(
                  labelText: 'Amount Tendered (₹)',
                  border: OutlineInputBorder(),
                ),
                onChanged: (_) => setState(() {}),
              ),
              if (_change > 0) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.green.shade50,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.change_circle, color: Colors.green),
                      const SizedBox(width: 8),
                      Text(
                        'Change: ₹${_change.toStringAsFixed(2)}',
                        style: const TextStyle(
                            color: Colors.green, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ),
              ],
            ],
            const SizedBox(height: 16),
            // Receipt options
            const Text('Send Receipt',
                style: TextStyle(fontWeight: FontWeight.w600)),
            Row(
              children: [
                _Toggle('Email', Icons.email, _sendEmail,
                    (v) => setState(() => _sendEmail = v)),
                _Toggle('SMS', Icons.sms, _sendSms,
                    (v) => setState(() => _sendSms = v)),
                _Toggle('WhatsApp', Icons.chat, _sendWhatsApp,
                    (v) => setState(() => _sendWhatsApp = v)),
              ],
            ),
            const Divider(),
            // Totals
            _SummaryRow('Subtotal', cart.subtotal),
            if (cart.couponDiscount > 0)
              _SummaryRow('Coupon Discount', -cart.couponDiscount,
                  color: Colors.green),
            _SummaryRow('Tax', cart.totalTax),
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
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _processing ? null : _placeOrder,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF6C63FF),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                child: _processing
                    ? const CircularProgressIndicator(color: Colors.white)
                    : Text(
                        'Place Order  •  ₹${cart.grandTotal.toStringAsFixed(2)}',
                        style:
                            const TextStyle(fontSize: 16, color: Colors.white),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Widget _Toggle(
    String label, IconData icon, bool value, ValueChanged<bool> onChanged) {
  return Expanded(
    child: InkWell(
      onTap: () => onChanged(!value),
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Checkbox(value: value, onChanged: (v) => onChanged(v ?? false)),
            Icon(icon, size: 16),
            const SizedBox(width: 4),
            Flexible(child: Text(label, style: const TextStyle(fontSize: 12))),
          ],
        ),
      ),
    ),
  );
}

Widget _SummaryRow(String label, double amount, {Color? color}) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: color ?? Colors.grey)),
          Text('₹${amount.abs().toStringAsFixed(2)}',
              style: TextStyle(color: color)),
        ],
      ),
    );
