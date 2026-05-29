import os
import pickle
import osmnx as ox
from pathlib import Path

def download_and_pickle():
    # Base paths
    base_dir = Path(__file__).resolve().parents[2]
    out_dir = base_dir / "data" / "processed" / "osmnx"
    out_dir.mkdir(parents=True, exist_ok=True)
    
    graphml_path = out_dir / "jabodetabek.graphml"
    pkl_path = out_dir / "jabodetabek.pkl"
    
    print("🚀 Downloading OSMnx graph for FULL JABODETABEK area via Bounding Box...")
    print("This might take a while because the area is quite large (100km x 100km).")
    
    ox.settings.use_cache = True
    ox.settings.timeout = 1800  # Increase timeout to 30 minutes for huge map!
    try:
        # Bounding box for Jabodetabek: (north, south, east, west)
        bbox = (-5.8400, -6.8200, 107.3100, 106.3700)
        G = ox.graph_from_bbox(
            bbox=bbox,
            network_type="drive",
            simplify=True,
        )
        print(f"✅ Downloaded graph with {len(G.nodes)} nodes and {len(G.edges)} edges.")
        
        print(f"💾 Saving to {graphml_path} ...")
        ox.save_graphml(G, filepath=graphml_path)
        
        print(f"📦 Pickling graph to {pkl_path} for fast loading...")
        with open(pkl_path, "wb") as f:
            pickle.dump(G, f)
            
        print("🎉 Selesai! File map berhasil dikembalikan!")
    except Exception as e:
        print(f"❌ Error downloading graph: {e}")

if __name__ == "__main__":
    download_and_pickle()
