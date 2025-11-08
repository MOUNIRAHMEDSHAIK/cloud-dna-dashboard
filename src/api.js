// src/api.js
// Handles API communication between React frontend and AWS API Gateway + Lambda

const RESOURCES_API = process.env.REACT_APP_API_RESOURCES;
const ANALYZE_API = process.env.REACT_APP_API_ANALYZE;

// ✅ Fetch all resources from DynamoDB (via Lambda → API Gateway)
export async function fetchResources() {
  try {
    const response = await fetch(RESOURCES_API);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    console.log("Fetched Resources:", data);
    return data;
  } catch (error) {
    console.error("Error fetching resources:", error);
    throw error;
  }
}

// ✅ Analyze a specific resource’s impact (VPC, EC2, etc.)
export async function analyzeResourceImpact(resourceId) {
  try {
    const response = await fetch(ANALYZE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ResourceId: resourceId }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Impact Analysis Result:", data);
    return data;
  } catch (error) {
    console.error("Error analyzing resource:", error);
    throw error;
  }
}
