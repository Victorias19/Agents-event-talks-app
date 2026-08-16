"""
BigQuery Release Notes Feed Parser & API Helper
"""
import urllib.request
import xml.etree.ElementTree as ET
import re
from bs4 import BeautifulSoup
from datetime import datetime

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def fetch_feed_data():
    req = urllib.request.Request(
        FEED_URL,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "Accept": "application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.8"
        }
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        xml_bytes = resp.read()
    return parse_atom_feed(xml_bytes)

def parse_atom_feed(xml_bytes):
    root = ET.fromstring(xml_bytes)
    ns = {"atom": "http://www.w3.org/2005/Atom"}
    
    feed_title = root.findtext("atom:title", default="BigQuery - Release notes", namespaces=ns)
    feed_updated = root.findtext("atom:updated", default="", namespaces=ns)
    
    entries = []
    category_counts = {}
    
    atom_entries = root.findall("atom:entry", ns)
    
    for idx, entry in enumerate(atom_entries):
        title = entry.findtext("atom:title", default="", namespaces=ns).strip()
        entry_id = entry.findtext("atom:id", default=f"entry-{idx}", namespaces=ns).strip()
        updated_str = entry.findtext("atom:updated", default="", namespaces=ns).strip()
        
        link_el = entry.find("atom:link", ns)
        link = link_el.attrib.get("href", "") if link_el is not None else "https://docs.cloud.google.com/bigquery/docs/release-notes"
        
        content_html = entry.findtext("atom:content", default="", namespaces=ns)
        
        # Parse items inside content
        parsed_items = parse_entry_content(content_html, idx, link, title)
        
        categories_in_entry = set()
        for item in parsed_items:
            cat = item["category"]
            categories_in_entry.add(cat)
            category_counts[cat] = category_counts.get(cat, 0) + 1
            
        entries.append({
            "id": f"entry-{idx}",
            "raw_id": entry_id,
            "title": title,
            "date": title,
            "updated_iso": updated_str,
            "link": link,
            "categories": list(categories_in_entry),
            "items": parsed_items,
            "item_count": len(parsed_items)
        })
        
    return {
        "title": feed_title,
        "updated": feed_updated,
        "feed_url": FEED_URL,
        "total_entries": len(entries),
        "total_items": sum(len(e["items"]) for e in entries),
        "category_counts": category_counts,
        "entries": entries
    }

def parse_entry_content(html_content, entry_idx, default_link, entry_title):
    if not html_content:
        return []
        
    soup = BeautifulSoup(html_content, "html.parser")
    items = []
    
    h3_elements = soup.find_all("h3")
    
    if not h3_elements:
        # If no h3 tags, treat the whole content as one item
        text = soup.get_text(" ", strip=True)
        summary = create_summary(text)
        items.append({
            "id": f"item-{entry_idx}-0",
            "category": "Update",
            "html": str(soup),
            "text": text,
            "summary": summary,
            "date": entry_title,
            "link": default_link,
            "tags": extract_tags(text, "Update")
        })
        return items

    # Loop through each h3 and collect subsequent sibling elements until next h3
    for h3_idx, h3 in enumerate(h3_elements):
        category = h3.get_text(strip=True) or "Update"
        
        content_tags = []
        curr = h3.next_sibling
        while curr and curr.name != "h3":
            if curr.name:  # HTML element
                content_tags.append(str(curr))
            elif str(curr).strip():  # Text node
                content_tags.append(f"<p>{str(curr).strip()}</p>")
            curr = curr.next_sibling
            
        item_html = "".join(content_tags)
        item_soup = BeautifulSoup(item_html, "html.parser")
        
        # Ensure all links have target="_blank" and rel="noopener noreferrer"
        for a in item_soup.find_all("a"):
            a["target"] = "_blank"
            a["rel"] = "noopener noreferrer"
            # Ensure full url if relative
            if a.get("href", "").startswith("/"):
                a["href"] = "https://docs.cloud.google.com" + a["href"]
                
        cleaned_html = str(item_soup)
        plain_text = item_soup.get_text(" ", strip=True)
        # Normalize whitespace
        plain_text = re.sub(r"\s+", " ", plain_text).strip()
        summary = create_summary(plain_text)
        
        # Extract direct deep link from first anchor tag if present, else fallback to anchor link on page
        first_a = item_soup.find("a")
        item_link = first_a["href"] if first_a and first_a.get("href") else default_link
        
        items.append({
            "id": f"item-{entry_idx}-{h3_idx}",
            "category": category,
            "html": cleaned_html,
            "text": plain_text,
            "summary": summary,
            "date": entry_title,
            "link": default_link,
            "doc_link": item_link,
            "tags": extract_tags(plain_text, category)
        })
        
    return items

def create_summary(text, max_len=180):
    if not text:
        return ""
    # Split on first sentence
    sentences = re.split(r'(?<=[.!?])\s+', text)
    if sentences and len(sentences[0]) > 20:
        first_sentence = sentences[0]
        if len(first_sentence) <= max_len:
            return first_sentence
    if len(text) <= max_len:
        return text
    return text[:max_len].rsplit(" ", 1)[0] + "..."

def extract_tags(text, category):
    tags = []
    lower = text.lower()
    
    if "preview" in lower:
        tags.append("Preview")
    elif "generally available" in lower or " ga" in lower or "(ga)" in lower:
        tags.append("GA")
        
    if "sql" in lower:
        tags.append("SQL")
    if "gemini" in lower or "ai" in lower or "vector" in lower:
        tags.append("AI/ML")
    if "security" in lower or "encryption" in lower:
        tags.append("Security")
    if "performance" in lower or "partition" in lower or "cluster" in lower:
        tags.append("Performance")
    if "connector" in lower or "driver" in lower or "jdbc" in lower:
        tags.append("Connectivity")
    if "deprecated" in lower or "deprecation" in lower:
        tags.append("Deprecation")
        
    return tags

if __name__ == "__main__":
    data = fetch_feed_data()
    print("Feed Title:", data["title"])
    print("Total Entries:", data["total_entries"])
    print("Total Items:", data["total_items"])
    print("Categories:", data["category_counts"])
    print("Sample Item:", data["entries"][0]["items"][0])
