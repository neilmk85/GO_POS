import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/models.dart';

class ApiService {
  static const String baseUrl = 'http://localhost:8080/api';
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;

  late final Dio _dio;
  final _storage = const FlutterSecureStorage();

  ApiService._internal() {
    _dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 30),
      headers: {'Content-Type': 'application/json'},
    ));

    // Attach JWT token
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _storage.read(key: 'accessToken');
        if (token != null) options.headers['Authorization'] = 'Bearer $token';
        handler.next(options);
      },
      onError: (error, handler) async {
        if (error.response?.statusCode == 401) {
          await _storage.deleteAll();
        }
        handler.next(error);
      },
    ));
  }

  // ---- Auth ----
  Future<AuthResponse> login(String email, String password) async {
    final res = await _dio.post('/auth/login', data: {'email': email, 'password': password});
    final auth = AuthResponse.fromJson(res.data['data']);
    await _storage.write(key: 'accessToken', value: auth.accessToken);
    await _storage.write(key: 'refreshToken', value: auth.refreshToken);
    return auth;
  }

  Future<void> logout() async => await _storage.deleteAll();

  // ---- Products ----
  Future<List<Product>> searchProducts(String query) async {
    final res = await _dio.get('/products/search', queryParameters: {'q': query});
    return (res.data['data'] as List).map((e) => Product.fromJson(e)).toList();
  }

  Future<Product?> getProductByBarcode(String barcode) async {
    try {
      final res = await _dio.get('/products/barcode/$barcode');
      return Product.fromJson(res.data['data']);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      rethrow;
    }
  }

  Future<List<Product>> getProducts({int page = 0, int size = 50}) async {
    final res = await _dio.get('/products', queryParameters: {'page': page, 'size': size});
    final content = res.data['data']['content'] as List;
    return content.map((e) => Product.fromJson(e)).toList();
  }

  Future<List<Product>> getLowStockProducts(int outletId) async {
    final res = await _dio.get('/products/low-stock', queryParameters: {'outletId': outletId});
    return (res.data['data'] as List).map((e) => Product.fromJson(e)).toList();
  }

  // ---- Customers ----
  Future<List<Customer>> searchCustomers(String query) async {
    final res = await _dio.get('/customers/search', queryParameters: {'q': query});
    return (res.data['data'] as List).map((e) => Customer.fromJson(e)).toList();
  }

  Future<Customer> getCustomerByPhone(String phone) async {
    final res = await _dio.get('/customers/phone/$phone');
    return Customer.fromJson(res.data['data']);
  }

  Future<Customer> createCustomer(Map<String, dynamic> data) async {
    final res = await _dio.post('/customers', data: data);
    return Customer.fromJson(res.data['data']);
  }

  // ---- Orders ----
  Future<Order> checkout(Map<String, dynamic> data) async {
    final res = await _dio.post('/orders/checkout', data: data);
    return Order.fromJson(res.data['data']);
  }

  Future<List<Order>> getOrdersByOutlet(int outletId, {int page = 0}) async {
    final res = await _dio.get('/orders/outlet/$outletId', queryParameters: {'page': page, 'size': 30});
    final content = res.data['data']['content'] as List;
    return content.map((e) => Order.fromJson(e)).toList();
  }

  // ---- Inventory ----
  Future<List<Inventory>> getLowStock(int outletId) async {
    final res = await _dio.get('/inventory/low-stock', queryParameters: {'outletId': outletId});
    return (res.data['data'] as List).map((e) => Inventory.fromJson(e)).toList();
  }

  Future<List<dynamic>> getStockAcrossOutlets(int productId) async {
    final res = await _dio.get('/inventory/product/$productId/all-outlets');
    return res.data['data'] as List;
  }

  // ---- Coupons ----
  Future<Map<String, dynamic>> validateCoupon(String code, double cartTotal) async {
    final res = await _dio.get('/discounts/coupons/validate', queryParameters: {'code': code, 'cartTotal': cartTotal});
    return res.data['data'] as Map<String, dynamic>;
  }

  // ---- Credit Notes ----
  Future<List<CreditNote>> getActiveCreditNotesByCustomer(int customerId) async {
    final res = await _dio.get('/credit-notes/customer/$customerId/active');
    return (res.data['data'] as List).map((e) => CreditNote.fromJson(e)).toList();
  }

  // ---- Reports ----
  Future<Map<String, dynamic>> getSalesSummary(int outletId, String from, String to) async {
    final res = await _dio.get('/reports/sales-summary', queryParameters: {'outletId': outletId, 'from': from, 'to': to});
    return res.data['data'] as Map<String, dynamic>;
  }

  Future<List<dynamic>> getTopProducts(int outletId, String from, String to) async {
    final res = await _dio.get('/reports/top-products', queryParameters: {'outletId': outletId, 'from': from, 'to': to});
    return res.data['data'] as List;
  }

  Future<List<dynamic>> getDailyTrend(int outletId, String from, String to) async {
    final res = await _dio.get('/reports/daily-trend', queryParameters: {'outletId': outletId, 'from': from, 'to': to});
    return res.data['data'] as List;
  }
}
