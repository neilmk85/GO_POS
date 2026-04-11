// =============================================
// POS Mobile - All Models
// =============================================

class AuthResponse {
  final String accessToken;
  final String refreshToken;
  final int userId;
  final String name;
  final String email;
  final List<String> roles;
  final int? outletId;
  final String? outletName;

  const AuthResponse({
    required this.accessToken,
    required this.refreshToken,
    required this.userId,
    required this.name,
    required this.email,
    required this.roles,
    this.outletId,
    this.outletName,
  });

  factory AuthResponse.fromJson(Map<String, dynamic> json) => AuthResponse(
        accessToken: json['accessToken'],
        refreshToken: json['refreshToken'],
        userId: json['userId'],
        name: json['name'],
        email: json['email'],
        roles: List<String>.from(json['roles'] ?? []),
        outletId: json['outletId'],
        outletName: json['outletName'],
      );
}

class Product {
  final int id;
  final String name;
  final String? description;
  final String? sku;
  final String? barcode;
  final double sellingPrice;
  final double? costPrice;
  final double? mrp;
  final String unitOfMeasure;
  final String? imageUrl;
  final bool active;
  final bool featured;
  final Category? category;
  final TaxGroup? taxGroup;
  final int reorderLevel;
  final bool trackInventory;

  const Product({
    required this.id,
    required this.name,
    this.description,
    this.sku,
    this.barcode,
    required this.sellingPrice,
    this.costPrice,
    this.mrp,
    required this.unitOfMeasure,
    this.imageUrl,
    required this.active,
    required this.featured,
    this.category,
    this.taxGroup,
    required this.reorderLevel,
    required this.trackInventory,
  });

  factory Product.fromJson(Map<String, dynamic> json) => Product(
        id: json['id'],
        name: json['name'],
        description: json['description'],
        sku: json['sku'],
        barcode: json['barcode'],
        sellingPrice: (json['sellingPrice'] as num).toDouble(),
        costPrice: json['costPrice'] != null ? (json['costPrice'] as num).toDouble() : null,
        mrp: json['mrp'] != null ? (json['mrp'] as num).toDouble() : null,
        unitOfMeasure: json['unitOfMeasure'] ?? 'pcs',
        imageUrl: json['imageUrl'],
        active: json['active'] ?? true,
        featured: json['featured'] ?? false,
        category: json['category'] != null ? Category.fromJson(json['category']) : null,
        taxGroup: json['taxGroup'] != null ? TaxGroup.fromJson(json['taxGroup']) : null,
        reorderLevel: json['reorderLevel'] ?? 10,
        trackInventory: json['trackInventory'] ?? true,
      );
}

class Category {
  final int id;
  final String name;
  final String? imageUrl;

  const Category({required this.id, required this.name, this.imageUrl});
  factory Category.fromJson(Map<String, dynamic> json) =>
      Category(id: json['id'], name: json['name'], imageUrl: json['imageUrl']);
}

class ProductVariant {
  final int id;
  final String name;
  final double price;
  final String? sku;
  final String? barcode;

  const ProductVariant({
    required this.id,
    required this.name,
    required this.price,
    this.sku,
    this.barcode,
  });

  factory ProductVariant.fromJson(Map<String, dynamic> json) => ProductVariant(
        id: json['id'],
        name: json['name'],
        price: (json['price'] as num).toDouble(),
        sku: json['sku'],
        barcode: json['barcode'],
      );
}

class TaxGroup {
  final int id;
  final String name;
  final double totalRate;
  final bool inclusive;

  const TaxGroup({required this.id, required this.name, required this.totalRate, required this.inclusive});
  factory TaxGroup.fromJson(Map<String, dynamic> json) => TaxGroup(
        id: json['id'],
        name: json['name'],
        totalRate: (json['totalRate'] as num).toDouble(),
        inclusive: json['inclusive'] ?? false,
      );
}

class Customer {
  final int id;
  final String name;
  final String? phone;
  final String? email;
  final String segment;
  final double loyaltyPoints;
  final double totalSpent;
  final double outstandingDue;
  final double discountPercent;
  final bool active;

  const Customer({
    required this.id,
    required this.name,
    this.phone,
    this.email,
    required this.segment,
    required this.loyaltyPoints,
    required this.totalSpent,
    required this.outstandingDue,
    required this.discountPercent,
    required this.active,
  });

  factory Customer.fromJson(Map<String, dynamic> json) => Customer(
        id: json['id'],
        name: json['name'],
        phone: json['phone'],
        email: json['email'],
        segment: json['segment'] ?? 'REGULAR',
        loyaltyPoints: (json['loyaltyPoints'] as num?)?.toDouble() ?? 0,
        totalSpent: (json['totalSpent'] as num?)?.toDouble() ?? 0,
        outstandingDue: (json['outstandingDue'] as num?)?.toDouble() ?? 0,
        discountPercent: (json['discountPercent'] as num?)?.toDouble() ?? 0,
        active: json['active'] ?? true,
      );
}

class CartItem {
  final int productId;
  final int? variantId;
  final String productName;
  final String? sku;
  int quantity;
  final double unitPrice;
  double discountPercent;
  final double taxRate;
  final String? imageUrl;

  CartItem({
    required this.productId,
    this.variantId,
    required this.productName,
    this.sku,
    required this.quantity,
    required this.unitPrice,
    this.discountPercent = 0,
    this.taxRate = 0,
    this.imageUrl,
  });

  double get lineTotal => unitPrice * quantity;
  double get discountAmount => lineTotal * discountPercent / 100;
  double get taxAmount => (lineTotal - discountAmount) * taxRate / 100;
  double get total => lineTotal - discountAmount + taxAmount;
}

class Order {
  final int id;
  final String orderNumber;
  final String status;
  final double subtotal;
  final double discountAmount;
  final double taxAmount;
  final double totalAmount;
  final double paidAmount;
  final Customer? customer;
  final List<OrderItem> items;
  final List<Payment> payments;
  final String createdAt;

  const Order({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.subtotal,
    required this.discountAmount,
    required this.taxAmount,
    required this.totalAmount,
    required this.paidAmount,
    this.customer,
    required this.items,
    required this.payments,
    required this.createdAt,
  });

  factory Order.fromJson(Map<String, dynamic> json) => Order(
        id: json['id'],
        orderNumber: json['orderNumber'],
        status: json['status'],
        subtotal: (json['subtotal'] as num).toDouble(),
        discountAmount: (json['discountAmount'] as num?)?.toDouble() ?? 0,
        taxAmount: (json['taxAmount'] as num?)?.toDouble() ?? 0,
        totalAmount: (json['totalAmount'] as num).toDouble(),
        paidAmount: (json['paidAmount'] as num?)?.toDouble() ?? 0,
        customer: json['customer'] != null ? Customer.fromJson(json['customer']) : null,
        items: (json['items'] as List?)?.map((e) => OrderItem.fromJson(e)).toList() ?? [],
        payments: (json['payments'] as List?)?.map((e) => Payment.fromJson(e)).toList() ?? [],
        createdAt: json['createdAt'] ?? '',
      );
}

class OrderItem {
  final int id;
  final String productName;
  final double quantity;
  final double unitPrice;
  final double lineTotal;

  const OrderItem({
    required this.id,
    required this.productName,
    required this.quantity,
    required this.unitPrice,
    required this.lineTotal,
  });

  factory OrderItem.fromJson(Map<String, dynamic> json) => OrderItem(
        id: json['id'],
        productName: json['productName'],
        quantity: (json['quantity'] as num).toDouble(),
        unitPrice: (json['unitPrice'] as num).toDouble(),
        lineTotal: (json['lineTotal'] as num).toDouble(),
      );
}

class Payment {
  final int id;
  final String paymentMethod;
  final double amount;

  const Payment({required this.id, required this.paymentMethod, required this.amount});
  factory Payment.fromJson(Map<String, dynamic> json) => Payment(
        id: json['id'],
        paymentMethod: json['paymentMethod'],
        amount: (json['amount'] as num).toDouble(),
      );
}

class Inventory {
  final int id;
  final Product product;
  final double quantityOnHand;
  final int reorderLevel;

  const Inventory({
    required this.id,
    required this.product,
    required this.quantityOnHand,
    required this.reorderLevel,
  });

  factory Inventory.fromJson(Map<String, dynamic> json) => Inventory(
        id: json['id'],
        product: Product.fromJson(json['product']),
        quantityOnHand: (json['quantityOnHand'] as num).toDouble(),
        reorderLevel: json['reorderLevel'] ?? 10,
      );

  bool get isLowStock => quantityOnHand <= reorderLevel;
}

class CreditNote {
  final int id;
  final String creditNoteNumber;
  final double totalAmount;
  final double remainingAmount;
  final String status;
  final String? expiryDate;
  final String? reason;

  const CreditNote({
    required this.id,
    required this.creditNoteNumber,
    required this.totalAmount,
    required this.remainingAmount,
    required this.status,
    this.expiryDate,
    this.reason,
  });

  factory CreditNote.fromJson(Map<String, dynamic> json) => CreditNote(
        id: json['id'],
        creditNoteNumber: json['creditNoteNumber'],
        totalAmount: (json['totalAmount'] as num).toDouble(),
        remainingAmount: (json['remainingAmount'] as num).toDouble(),
        status: json['status'],
        expiryDate: json['expiryDate'],
        reason: json['reason'],
      );
}
