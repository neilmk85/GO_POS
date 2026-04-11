import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/models.dart';

class CartState {
  final List<CartItem> items;
  final Customer? customer;
  final String? couponCode;
  final double couponDiscount;
  final double loyaltyPointsRedeemed;

  const CartState({
    this.items = const [],
    this.customer,
    this.couponCode,
    this.couponDiscount = 0,
    this.loyaltyPointsRedeemed = 0,
  });

  double get subtotal => items.fold(0.0, (s, i) => s + i.lineTotal);
  double get totalDiscount =>
      items.fold(0.0, (s, i) => s + i.discountAmount) + couponDiscount;
  double get totalTax => items.fold(0.0, (s, i) => s + i.taxAmount);
  double get grandTotal => subtotal - couponDiscount - loyaltyPointsRedeemed;
  int get itemCount => items.fold(0, (s, i) => s + i.quantity);

  CartState copyWith({
    List<CartItem>? items,
    Customer? customer,
    bool clearCustomer = false,
    String? couponCode,
    bool clearCoupon = false,
    double? couponDiscount,
    double? loyaltyPointsRedeemed,
  }) =>
      CartState(
        items: items ?? this.items,
        customer: clearCustomer ? null : (customer ?? this.customer),
        couponCode: clearCoupon ? null : (couponCode ?? this.couponCode),
        couponDiscount: clearCoupon ? 0 : (couponDiscount ?? this.couponDiscount),
        loyaltyPointsRedeemed:
            loyaltyPointsRedeemed ?? this.loyaltyPointsRedeemed,
      );
}

class CartNotifier extends StateNotifier<CartState> {
  CartNotifier() : super(const CartState());

  void addItem(Product product, {ProductVariant? variant, int qty = 1}) {
    final existingIndex = state.items.indexWhere(
      (i) => i.productId == product.id && i.variantId == variant?.id,
    );
    if (existingIndex >= 0) {
      final updated = List<CartItem>.from(state.items);
      updated[existingIndex].quantity += qty;
      state = state.copyWith(items: updated);
    } else {
      final price = variant?.price ?? product.sellingPrice;
      final taxRate = product.taxGroup?.totalRate ?? 0.0;
      state = state.copyWith(items: [
        ...state.items,
        CartItem(
          productId: product.id,
          variantId: variant?.id,
          productName: variant != null
              ? '${product.name} - ${variant.name}'
              : product.name,
          sku: variant?.sku ?? product.sku,
          quantity: qty,
          unitPrice: price,
          taxRate: taxRate,
          imageUrl: product.imageUrl,
        ),
      ]);
    }
  }

  void updateQuantity(int index, int qty) {
    if (qty <= 0) {
      removeItem(index);
      return;
    }
    final updated = List<CartItem>.from(state.items);
    updated[index].quantity = qty;
    state = state.copyWith(items: updated);
  }

  void setDiscount(int index, double discountPercent) {
    final updated = List<CartItem>.from(state.items);
    updated[index].discountPercent = discountPercent;
    state = state.copyWith(items: updated);
  }

  void removeItem(int index) {
    final updated = List<CartItem>.from(state.items)..removeAt(index);
    state = state.copyWith(items: updated);
  }

  void setCustomer(Customer? customer) =>
      state = state.copyWith(customer: customer, clearCustomer: customer == null);

  void applyCoupon(String code, double discount) =>
      state = state.copyWith(couponCode: code, couponDiscount: discount);

  void removeCoupon() => state = state.copyWith(clearCoupon: true);

  void setLoyaltyRedemption(double points) =>
      state = state.copyWith(loyaltyPointsRedeemed: points);

  void clear() => state = const CartState();
}

final cartProvider =
    StateNotifierProvider<CartNotifier, CartState>((_) => CartNotifier());
