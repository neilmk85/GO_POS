import 'package:home_widget/home_widget.dart';
import 'package:intl/intl.dart';
import '../utils/parse.dart' as p;
import 'api_service.dart';

class WidgetService {
  static const _androidWidgetName = 'PipesWidget';

  final ApiService _api;
  WidgetService(this._api);

  Future<void> refresh({required int outletId}) async {
    try {
      final today = DateFormat('yyyy-MM-dd').format(DateTime.now());

      // Total available finished-pipe inventory
      // quantityOnHand comes as a decimal string from Go — use p.d() to parse safely
      final inventory = await _api.getInventoryByOutlet(outletId, size: 500);
      final available = inventory
          .where((i) =>
              (i['product']?['itemType'] ?? '') == 'FINISHED_PIPE' &&
              p.d(i['quantityOnHand']) > 0)
          .fold<int>(0, (sum, i) => sum + p.d(i['quantityOnHand']).toInt());

      // Total pipes loaded today
      final records = await _api.getLoadingRecords(date: today, size: 500);
      final loaded = records.fold<int>(
          0, (sum, r) => sum + p.d(r['quantity']).toInt());

      final timestamp = DateFormat('d MMM, h:mm a').format(DateTime.now());

      await Future.wait([
        HomeWidget.saveWidgetData<int>('pipes_available', available),
        HomeWidget.saveWidgetData<int>('pipes_loaded_today', loaded),
        HomeWidget.saveWidgetData<String>('widget_updated_at', timestamp),
      ]);

      await HomeWidget.updateWidget(androidName: _androidWidgetName);
    } catch (e, st) {
      // ignore: avoid_print
      print('WidgetService.refresh error: $e\n$st');
    }
  }
}
