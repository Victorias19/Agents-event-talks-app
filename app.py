import time
import os
from flask import Flask, render_template, jsonify, request
from feed_parser import fetch_feed_data

app = Flask(__name__)

# In-memory cache for feed data
_cache = {
    "data": None,
    "last_fetched": 0,
    "ttl_seconds": 300  # 5 minutes default cache
}

def get_feed_data(force_refresh=False):
    now = time.time()
    if (
        not force_refresh
        and _cache["data"] is not None
        and (now - _cache["last_fetched"]) < _cache["ttl_seconds"]
    ):
        return _cache["data"], False, None

    try:
        data = fetch_feed_data()
        data["fetched_at"] = time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())
        data["fetched_timestamp"] = int(time.time() * 1000)
        _cache["data"] = data
        _cache["last_fetched"] = now
        return data, True, None
    except Exception as e:
        # If fetch fails but we have cached data, return cached data with warning
        if _cache["data"] is not None:
            return _cache["data"], False, f"Live fetch failed ({str(e)}). Serving cached release notes."
        return None, False, str(e)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/feed", methods=["GET"])
def api_feed():
    force = request.args.get("force_refresh", "").lower() in ("true", "1", "yes")
    data, fresh, error_msg = get_feed_data(force_refresh=force)
    
    if data is None:
        return jsonify({
            "status": "error",
            "message": f"Failed to fetch BigQuery release notes: {error_msg}"
        }), 502

    response = {
        "status": "success",
        "fresh": fresh,
        "warning": error_msg,
        "data": data
    }
    return jsonify(response)


@app.route("/api/stats", methods=["GET"])
def api_stats():
    data, _, error_msg = get_feed_data(force_refresh=False)
    if data is None:
        return jsonify({"status": "error", "message": error_msg}), 502
    
    return jsonify({
        "status": "success",
        "title": data.get("title"),
        "total_entries": data.get("total_entries", 0),
        "total_items": data.get("total_items", 0),
        "category_counts": data.get("category_counts", {}),
        "latest_update": data.get("entries", [{}])[0].get("date", "N/A") if data.get("entries") else "N/A",
        "last_fetched": data.get("fetched_at")
    })


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "healthy", "service": "bigquery-release-notes-app"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"Starting BigQuery Release Notes App on http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
