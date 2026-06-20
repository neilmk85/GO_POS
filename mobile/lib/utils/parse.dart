/// Safe numeric parsing helpers.
/// Go's JSON encoder sometimes serialises numeric DB columns as strings.
/// These helpers accept both num and String inputs gracefully.

/// Returns a double. Falls back to 0.0 on null or unparseable input.
double d(dynamic v) {
  if (v == null) return 0.0;
  if (v is num) return v.toDouble();
  if (v is String) return double.tryParse(v) ?? 0.0;
  return 0.0;
}

/// Returns a double or null if the value is null/missing.
double? dOrNull(dynamic v) {
  if (v == null) return null;
  if (v is num) return v.toDouble();
  if (v is String) {
    final parsed = double.tryParse(v);
    return parsed;
  }
  return null;
}

/// Returns an int. Falls back to 0 on null or unparseable input.
int i(dynamic v) {
  if (v == null) return 0;
  if (v is int) return v;
  if (v is num) return v.toInt();
  if (v is String) return int.tryParse(v) ?? 0;
  return 0;
}

/// Returns an int or null if the value is null/missing.
int? iOrNull(dynamic v) {
  if (v == null) return null;
  if (v is int) return v;
  if (v is num) return v.toInt();
  if (v is String) return int.tryParse(v);
  return null;
}
