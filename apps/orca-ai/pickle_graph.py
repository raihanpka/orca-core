import os
import pickle
import networkx as nx
import xml.etree.ElementTree as ET

base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
graphml_path = os.path.join(base_dir, "data", "processed", "osmnx", "jabodetabek.graphml")
pkl_path = os.path.join(base_dir, "data", "processed", "osmnx", "jabodetabek.pkl")

def streaming_graphml_to_nx(path):
    print(f"Starting SAX streaming parser for {path} ...")
    G = nx.MultiDiGraph()
    G.graph['crs'] = 'epsg:4326'
    
    # GraphML namespace
    ns = '{http://graphml.graphdrawing.org/xmlns}'
    
    node_keys = {}
    edge_keys = {}
    
    context = ET.iterparse(path, events=('start', 'end'))
    
    nodes_count = 0
    edges_count = 0
    
    # We clear root elements progressively to save memory
    _, root = next(context)
    
    for event, elem in context:
        if event != 'end':
            continue
            
        tag = elem.tag.replace(ns, '')
        
        if tag == 'key':
            for_type = elem.attrib.get('for')
            key_id = elem.attrib.get('id')
            attr_name = elem.attrib.get('attr.name')
            if for_type == 'node':
                node_keys[key_id] = attr_name
            elif for_type == 'edge':
                edge_keys[key_id] = attr_name
            root.clear()
            
        elif tag == 'node':
            # osmnx node ids are int
            node_id_str = elem.attrib.get('id')
            try:
                node_id = int(node_id_str)
            except ValueError:
                node_id = node_id_str # fallback
                
            attrs = {}
            for data in list(elem):
                if data.tag.replace(ns, '') == 'data':
                    key_id = data.attrib.get('key')
                    if key_id in node_keys:
                        val = data.text
                        attr_name = node_keys[key_id]
                        if attr_name in ('x', 'y'):
                            try:
                                val = float(val)
                            except:
                                pass
                        attrs[attr_name] = val
            G.add_node(node_id, **attrs)
            nodes_count += 1
            if nodes_count % 100000 == 0:
                print(f"Loaded {nodes_count} nodes...")
            elem.clear()
            root.clear()
            
        elif tag == 'edge':
            source_str = elem.attrib.get('source')
            target_str = elem.attrib.get('target')
            try:
                source = int(source_str)
                target = int(target_str)
            except ValueError:
                source = source_str
                target = target_str
                
            attrs = {}
            for data in list(elem):
                if data.tag.replace(ns, '') == 'data':
                    key_id = data.attrib.get('key')
                    if key_id in edge_keys:
                        val = data.text
                        attr_name = edge_keys[key_id]
                        if attr_name == 'length':
                            try:
                                val = float(val)
                            except:
                                pass
                        attrs[attr_name] = val
            
            # Since osmnx MultiDiGraph requires a key parameter for edges, 
            # we default to 0 like osmnx does.
            G.add_edge(source, target, key=0, **attrs)
            edges_count += 1
            if edges_count % 100000 == 0:
                print(f"Loaded {edges_count} edges...")
            elem.clear()
            root.clear()
            
    print(f"Finished parsing. Total Nodes: {nodes_count}, Total Edges: {edges_count}")
    return G

if __name__ == "__main__":
    if os.path.exists(graphml_path):
        print("Parsing with fast streaming SAX parser to avoid OOM...")
        G = streaming_graphml_to_nx(graphml_path)
        print(f"Pickling graph to {pkl_path}")
        with open(pkl_path, "wb") as f:
            pickle.dump(G, f, protocol=pickle.HIGHEST_PROTOCOL)
        print("Done!")
    else:
        print(f"Error: {graphml_path} not found.")
