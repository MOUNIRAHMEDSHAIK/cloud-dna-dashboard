import React, { useState, useEffect } from 'react';
// --- NEW: Added 'post' for Step Functions ---
import { get, post } from 'aws-amplify/api'; 
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap,
  Panel,
  Handle,      
  Position,
  // --- NEW: Need this provider to use React Flow hooks ---
  ReactFlowProvider, 
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
  Search, Layers, RefreshCw, Server, Database, Container, 
  Network, Cloud, Package, Info, 
  // --- NEW: Added Zap icon for the button ---
  Zap 
} from 'lucide-react';

// --- Resource Color/Icon Helpers (Unchanged) ---
const getResourceColor = (resourceType) => {
  if (!resourceType) return '#999'; 
  const colors = {
    'EC2': '#FF9900', 'S3': '#569A31', 'RDS': '#527FFF', 'Lambda': '#FF9900',
    'VPC': '#3F4EDE', 'DynamoDB': '#4053D6', 'ELB': '#8C4FFF', 'CloudFront': '#8C4FFF',
    'default': '#999'
  };
  for (const [key, color] of Object.entries(colors)) {
    if (resourceType.includes(key)) return color;
  }
  return colors.default;
};

const getResourceIcon = (resourceType) => {
  const iconProps = { size: 20, strokeWidth: 1.5 };
  if (!resourceType) return <Cloud {...iconProps} />;
  if (resourceType.includes('EC2')) return <Server {...iconProps} />;
  if (resourceType.includes('S3')) return <Container {...iconProps} />;
  if (resourceType.includes('RDS')) return <Database {...iconProps} />;
  if (resourceType.includes('DynamoDB')) return <Database {...iconProps} />;
  if (resourceType.includes('VPC')) return <Network {...iconProps} />;
  if (resourceType.includes('Lambda')) return <Package {...iconProps} />;
  return <Cloud {...iconProps} />;
};

// --- Custom Node Component (With Impact Highlighting) ---
const CustomNode = ({ data, selected }) => {
  const color = getResourceColor(data.ResourceType);
  const icon = getResourceIcon(data.ResourceType);
  
  // --- NEW: Check if this node is in the blast radius ---
  const isImpacted = data.isImpacted || false;

  return (
    <div style={{
      padding: '14px 18px',
      borderRadius: '10px',
      // --- NEW: Red border if impacted ---
      border: `2px solid ${isImpacted ? '#dc3545' : (selected ? '#667eea' : color)}`, 
      background: isImpacted
        ? 'linear-gradient(135deg, #4d1519 0%, #3a0e10 100%)' // Red background
        : (selected 
          ? 'linear-gradient(135deg, #3a3a4a 0%, #2a2a3a 100%)'
          : 'linear-gradient(135deg, #2a2a3a 0%, #1a1a2e 100%)'), 
      width: '240px',
      boxShadow: selected 
        ? '0 8px 24px rgba(102, 126, 234, 0.4)' 
        : '0 4px 12px rgba(0,0,0,0.3)',
      transition: 'all 0.3s ease',
      cursor: 'pointer',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: color, width: 8, height: 8, border: 'none' }} />
      <Handle type="source" position={Position.Right} style={{ background: color, width: 8, height: 8, border: 'none' }} />
      
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{ 
          color: color,
          background: `${color}20`,
          padding: '8px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <strong style={{ 
            color: '#eee', 
            fontSize: '13px',
            fontWeight: '600',
            display: 'block',
            marginBottom: '6px'
          }}>
            {data.ResourceType}
          </strong>
          <div style={{
            color: '#aaa', 
            fontSize: '11px',
            wordBreak: 'break-all',
            lineHeight: '1.4'
          }}>
            {data.ResourceId}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Department Header Node ---
const DepartmentNode = ({ data }) => {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: '#fff',
      padding: '12px 20px',
      borderRadius: '10px',
      fontSize: '15px',
      fontWeight: '700',
      textAlign: 'center',
      boxShadow: '0 4px 16px rgba(102, 126, 234, 0.3)',
      border: '2px solid rgba(255,255,255,0.2)',
      minWidth: '240px',
      letterSpacing: '0.5px'
    }}>
      {data.label}
    </div>
  );
};

// --- Node Types (Updated) ---
const nodeTypes = {
  custom: CustomNode,
  department: DepartmentNode
};

// --- Node Creation Function (Unchanged) ---
const createNodes = (resources) => {
  const nodeWidth = 240;
  const horizontalSpacing = 120;
  const verticalSpacing = 50;
  const nodeHeight = 90;
  const headerOffset = 120;
  
  const columns = {};
  
  resources.forEach(resource => {
    const type = resource.ResourceType.split('_')[0].split(' ')[0];
    if (!columns[type]) {
      columns[type] = [];
    }
    columns[type].push(resource);
  });

  const allNodes = [];
  const sortedTypes = Object.keys(columns).sort();
  let currentX = 80;

  sortedTypes.forEach((type) => {
    const resourcesInColumn = columns[type];
    
    allNodes.push({
      id: `title-${type}`,
      type: 'department',
      position: { x: currentX, y: 40 },
      data: { label: `${type} Resources` },
      selectable: false,
      draggable: false,
    });

    resourcesInColumn.forEach((resource, index) => {
      allNodes.push({
        id: resource.ResourceId,
        type: 'custom',
        position: { 
          x: currentX, 
          y: headerOffset + (index * (nodeHeight + verticalSpacing))
        },
        data: { ...resource },
        draggable: false,
      });
    });
    
    currentX += nodeWidth + horizontalSpacing;
  });
  
  return allNodes;
};

// --- Main App Component ---
function App() {
  const [resources, setResources] = useState([]); 
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedNode, setSelectedNode] = useState(null);
  
  // --- NEW: State for Impact Analysis ---
  const [blastRadius, setBlastRadius] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Fetch data from API
  useEffect(() => {
    async function fetchData() {
      try {
        const response = await get({ apiName: 'resourceApi', path: '/resources', }).response;
        const data = await response.body.json();
        setResources(data);
        setError(null);
      } catch (err) {
        setError(err.message || 'An error occurred while fetching data.');
        setResources([]);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []); 

  // --- UPDATED: This effect now runs when 'blastRadius' changes ---
  useEffect(() => {
    if (resources.length > 0) {
      console.log('Transforming resources into nodes and edges...');
      
      // Update nodes to mark them as impacted if their ID is in the blastRadius list
      const graphNodes = createNodes(resources).map(node => ({
        ...node,
        data: {
          ...node.data,
          // Check if this resource ID is part of the blast radius
          isImpacted: blastRadius.includes(node.id) 
        }
      }));
      
      const graphEdges = [];
      for (const resource of resources) {
        // Genealogy Mapping (VPC to EC2)
        if (resource.ParentVPC) {
          if (resources.some(r => r.ResourceId === resource.ParentVPC)) {
            graphEdges.push({
              id: `e-${resource.ResourceId}-${resource.ParentVPC}`,
              source: resource.ParentVPC, // Source is the VPC
              target: resource.ResourceId,   // Target is the EC2 instance
              animated: true,
              type: 'smoothstep',
              style: { 
                stroke: '#667eea', 
                strokeWidth: 2,
                // Highlight the edge if source or target is in blast radius
                opacity: (blastRadius.includes(resource.ResourceId) || blastRadius.includes(resource.ParentVPC)) ? 1 : 0.4
              }
            });
          }
        }
      }
      
      setNodes(graphNodes);
      setEdges(graphEdges);
    }
  }, [resources, blastRadius]); // Rerun whenever blastRadius changes

  // --- NEW: Impact Analysis Handler (Module 3) ---
  const handleAnalyzeImpact = async (resourceId) => {
    if (!resourceId) return;

    setIsAnalyzing(true);
    setBlastRadius([]); // Clear previous highlighting
    
    // Visually highlight the starting node immediately
    setNodes(prevNodes => prevNodes.map(n => ({
      ...n,
      data: { ...n.data, isImpacted: n.id === resourceId }
    })));
    
    try {
      // 1. Call the new /analyze API endpoint (which triggers the Step Function)
      const response = await post({
        apiName: 'resourceApi',
        path: '/analyze',
        options: {
          body: { ResourceId: resourceId } // Send the ID of the resource to analyze
        }
      }).response;

      // 2. Get the Step Function Execution ARN
      const execution = await response.body.json();
      console.log('Started Step Function execution:', execution.executionArn);
      
      // 3. (Simplified for this project) We will poll our *own* Lambda
      //    In a real app, you'd poll the Step Function ARN
      //    We'll just find the children from the data we already have.
      
      if (selectedNode.data.ResourceType === 'VPC') {
        const impactedResources = resources
          .filter(r => r.ParentVPC === resourceId)
          .map(r => r.ResourceId);
        
        // Add the analyzed VPC itself to the list
        setBlastRadius([resourceId, ...impactedResources]); 
      } else {
        setBlastRadius([resourceId]);
      }
      
    } catch (err) {
      console.error('Impact Analysis Failed:', err);
      alert('Analysis failed. Check your API Gateway Mapping Template and Step Function Execution Role.');
    } finally {
      setIsAnalyzing(false);
    }
  };


  // Event handlers
  const onNodeClick = (event, node) => {
    if (node.id.startsWith('title-')) return; 
    setSelectedNode(node);
    setBlastRadius([]); // Clear blast radius on new selection
  };
  
  const onPaneClick = () => {
    setSelectedNode(null);
    setBlastRadius([]); // Clear blast radius when clicking the canvas
  };

  // Filter nodes (Unchanged)
  const filteredNodes = nodes.filter(node => {
    if (node.id.startsWith('title-')) return true; 
    const data = node.data;
    const matchesSearch = data.ResourceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          data.ResourceType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || data.ResourceType.includes(selectedType);
    return matchesSearch && matchesType;
  });

  // Get unique resource types (Unchanged)
  const resourceTypes = ['all', ...new Set(resources.map(r => {
    return r.ResourceType.split('_')[0].split(' ')[0]; 
  }))];

  // Loading State (Unchanged)
  if (isLoading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white'
      }}>
        <div style={{ textAlign: 'center' }}>
          <RefreshCw size={56} style={{ animation: 'spin 2s linear infinite' }} />
          <h2 style={{ marginTop: '24px', fontWeight: '500', fontSize: '24px' }}>Loading CloudDNA Resources...</h2>
        </div>
      </div>
    );
  }

  // Error State (Unchanged)
  if (error) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh',
        background: '#0f0f1e'
      }}>
        <div style={{
          background: '#1a1a2e', padding: '48px', borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)', textAlign: 'center',
          borderTop: '4px solid #dc3545', maxWidth: '500px'
        }}>
          <h2 style={{ color: '#dc3545', marginBottom: '16px', fontSize: '22px' }}>⚠️ Error Fetching Data</h2>
          <p style={{ color: '#ccc', fontSize: '14px' }}>{error}</p>
        </div>
      </div>
    );
  }

  // --- Main App Layout ---
  return (
    <div style={{ 
      height: '100vh', width: '100%', display: 'flex', flexDirection: 'column', 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', overflow: 'hidden'
    }}>
      {/* Header (Unchanged) */}
      <header style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', color: 'white', padding: '20px 40px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)', zIndex: 10, borderBottom: '2px solid #667eea'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              padding: '10px', borderRadius: '12px', display: 'flex',
              alignItems: 'center', justifyContent: 'center'
            }}>
              <Layers size={28} color="#fff" />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700', letterSpacing: '0.5px' }}>
                CloudDNA Dashboard
              </h1>
              <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#aaa' }}>
                AWS Resource Visualization
              </p>
            </div>
          </div>
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#fff', padding: '10px 20px', borderRadius: '24px',
            fontSize: '14px', fontWeight: '600', boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
          }}>
            {filteredNodes.filter(n => !n.id.startsWith('title-')).length} / {resources.length} Resources
          </div>
        </div>
      </header>

      {/* Static React Flow Canvas (Unchanged) */}
      <div style={{ flex: 1, position: 'relative', background: '#0f0f1e' }}>
        <ReactFlow
          nodes={filteredNodes}
          edges={edges}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          panOnDrag={true} 
          zoomOnScroll={true} 
          panOnScroll={false}
          zoomOnDoubleClick={true}
          minZoom={0.5}
          maxZoom={1.5}
          
          defaultEdgeOptions={{ animated: true, style: { stroke: '#667eea', strokeWidth: 2 }}}
        >
          <Background color="#667eea" gap={32} size={1} style={{ opacity: 0.15 }}/>
          <Controls 
            style={{
              background: '#1a1a2e',
              border: '1px solid #667eea',
              borderRadius: '8px',
              overflow: 'hidden'
            }} 
          />
          <MiniMap 
            nodeColor={(node) => {
              if (node.id.startsWith('title-')) return '#667eea';
              return getResourceColor(node.data.ResourceType);
            }}
            style={{
              background: '#1a1a2e',
              border: '2px solid #667eea',
              borderRadius: '10px'
            }}
            pannable={false}
            zoomable={false}
          />
          
          {/* Search and Filter Panel (Unchanged) */}
          <Panel position="top-right" style={{ 
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', 
            color: '#eee', padding: '20px', borderRadius: '16px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: '320px',
            border: '2px solid #667eea'
          }}>
            <h3 style={{ 
              margin: '0 0 16px 0', fontSize: '16px', fontWeight: '600',
              color: '#fff', display: 'flex', alignItems: 'center', gap: '8px'
            }}>
              <Search size={18} color="#667eea" />
              Search & Filter
            </h3>
            
            <div style={{ marginBottom: '16px' }}>
              <div style={{ 
                display: 'flex', alignItems: 'center', gap: '10px',
                border: '2px solid #667eea', borderRadius: '10px',
                padding: '10px 14px', background: '#0f0f1e', transition: 'all 0.2s'
              }}>
                <Search size={18} color="#667eea" />
                <input
                  type="text"
                  placeholder="Search resources..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    border: 'none', outline: 'none', flex: 1, fontSize: '14px',
                    background: 'transparent', color: '#eee'
                  }}
                />
              </div>
            </div>
            
            <div>
              <label style={{ 
                fontSize: '12px', color: '#aaa', marginBottom: '8px',
                display: 'block', fontWeight: '500'
              }}>
                Resource Type
              </label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px', borderRadius: '10px',
                  border: '2px solid #667eea', fontSize: '14px', cursor: 'pointer',
                  background: '#0f0f1e', color: '#eee', fontWeight: '500'
                }}
              >
                {resourceTypes.map(type => (
                  <option key={type} value={type} style={{ background: '#1a1a2e' }}>
                    {type === 'all' ? 'All Types' : type}
                  </option>
                ))}
              </select>
            </div>
          </Panel>
          
          {/* --- UPDATED: Selected Node Info Panel (with Blast Radius) --- */}
          {selectedNode && (
            <Panel position="bottom-left" style={{
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', 
              color: '#eee', padding: '20px', borderRadius: '16px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)', width: '380px',
              border: '2px solid #667eea'
            }}>
              <div style={{ 
                display: 'flex', alignItems: 'center', gap: '12px', 
                paddingBottom: '16px', borderBottom: '2px solid #667eea' 
              }}>
                <div style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  padding: '8px', borderRadius: '8px', display: 'flex'
                }}>
                  <Info size={20} color="#fff" />
                </div>
                <h3 style={{ margin: 0, fontSize: '17px', color: '#fff', fontWeight: '600' }}>
                  Resource Details
                </h3>
              </div>
              <div style={{ paddingTop: '16px', fontSize: '14px', color: '#ccc' }}>
                <div style={{ marginBottom: '14px' }}>
                  <strong style={{ color: '#667eea', fontSize: '12px', display: 'block', marginBottom: '6px' }}>
                    RESOURCE ID
                  </strong>
                  <div style={{ 
                    padding: '10px 12px', background: '#0f0f1e', borderRadius: '8px', 
                    wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '12px',
                    color: '#eee', border: '1px solid #667eea40'
                  }}>
                    {selectedNode.data.ResourceId}
                  </div>
                </div>
                <div style={{ marginBottom: '14px' }}>
                  <strong style={{ color: '#667eea', fontSize: '12px' }}>TYPE:</strong>
                  <span style={{ marginLeft: '8px', color: '#eee' }}>{selectedNode.data.ResourceType}</span>
                </div>
                {selectedNode.data.CreationDate && (
                  <div style={{ marginBottom: '14px' }}>
                    <strong style={{ color: '#667eea', fontSize: '12px' }}>CREATED:</strong>
                    <span style={{ marginLeft: '8px', color: '#eee' }}>{selectedNode.data.CreationDate}</span>
                  </div>
                )}
                {selectedNode.data.Owner && (
                  <div style={{ marginBottom: '14px' }}>
                    <strong style={{ color: '#667eea', fontSize: '12px' }}>OWNER:</strong>
                    <span style={{ marginLeft: '8px', color: '#eee' }}>{selectedNode.data.Owner}</span>
                  </div>
                )}
                
                {/* --- NEW: Impact Analysis Button (Module 3) --- */}
                {selectedNode.data.ResourceType === 'VPC' && (
                  <button
                    onClick={() => handleAnalyzeImpact(selectedNode.data.ResourceId)}
                    disabled={isAnalyzing}
                    style={{
                      width: '100%',
                      padding: '12px',
                      marginTop: '10px',
                      borderRadius: '8px',
                      border: 'none',
                      background: isAnalyzing ? '#4d1e9e' : 'linear-gradient(135deg, #FF5733 0%, #dc3545 100%)',
                      color: 'white',
                      fontWeight: 'bold',
                      cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px',
                      transition: '0.3s'
                    }}
                  >
                    <Zap size={18} />
                    {isAnalyzing ? 'Analyzing...' : 'Analyze Impact (Blast Radius)'}
                  </button>
                )}
                
                {/* --- NEW: Blast Radius Report Display --- */}
                {blastRadius.length > 0 && (
                  <div style={{ marginTop: '15px', borderTop: '1px dashed #667eea80', paddingTop: '10px' }}>
                    <strong style={{ color: '#FF5733', fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                      BLAST RADIUS ({blastRadius.filter(id => id !== selectedNode.data.ResourceId).length} Dependencies)
                    </strong>
                    <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '12px' }}>
                      {/* Filter out the source VPC/resource itself */}
                      {blastRadius.filter(id => id !== selectedNode.data.ResourceId).map(id => (
                        <li key={id} style={{ color: '#FF5733', wordBreak: 'break-all' }}>{id}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>

      {/* This adds the spin animation for the loading icon */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .react-flow__node.selected .custom-node {
          transform: scale(1.05);
        }
        
        .react-flow__controls button {
          background: #0f0f1e !important;
          border: 1px solid #667eea !important;
          color: #667eea !important;
        }
        
        .react-flow__controls button:hover {
          background: #667eea !important;
          color: #fff !important;
        }
      `}</style>
    </div>
  );
}

// --- NEW: Wrapper needed for React Flow functionality ---
// We must wrap the <App /> component in <ReactFlowProvider>
// so the 'createNodes' function can work.
function FlowWrapper() {
  return (
    <ReactFlowProvider>
      <App />
    </ReactFlowProvider>
  );
}

// --- NEW: Export the wrapper ---
export default FlowWrapper;