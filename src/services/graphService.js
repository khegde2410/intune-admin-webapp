import axios from 'axios';
import { graphConfig } from '../utils/graphConfig';

class GraphService {
  constructor() {
    // Use v1.0 by default so endpoints like `/deviceManagement/...` resolve correctly
    this.baseURL = 'https://graph.microsoft.com/v1.0';
  }

  async callMsGraph(endpoint, accessToken, method = 'GET', data = null) {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    const config = {
      method,
      url: `${this.baseURL}${endpoint}`,
      headers,
    };

    if (data && (method === 'POST' || method === 'PATCH')) {
      config.data = data;
    }

    try {
      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error('Graph API Error:', error.response?.data || error.message);
      throw error;
    }
  }

  async callMsGraphWithPaging(endpoint, accessToken) {
    let allData = [];
    let nextLink = `${this.baseURL}${endpoint}`;

    while (nextLink) {
      const headers = {
        Authorization: `Bearer ${accessToken}`,
      };

      try {
        const response = await axios.get(nextLink, { headers });
        const data = response.data;

        if (data.value && Array.isArray(data.value)) {
          allData = allData.concat(data.value);
        } else if (Array.isArray(data)) {
          allData = allData.concat(data);
        } else {
          allData.push(data);
        }

        nextLink = data['@odata.nextLink'];
      } catch (error) {
        console.error('Graph API Paging Error:', error.response?.data || error.message);
        throw error;
      }
    }

    return allData;
  }

  // Call Beta API endpoint with paging
  async callMsGraphBeta(endpoint, accessToken) {
    let allData = [];
    let nextLink = `https://graph.microsoft.com/beta${endpoint}`;

    while (nextLink) {
      const headers = {
        Authorization: `Bearer ${accessToken}`,
      };

      try {
        const response = await axios.get(nextLink, { headers });
        const data = response.data;

        if (data.value && Array.isArray(data.value)) {
          allData = allData.concat(data.value);
        } else if (Array.isArray(data)) {
          allData = allData.concat(data);
        } else {
          allData.push(data);
        }

        nextLink = data['@odata.nextLink'];
      } catch (error) {
        console.error('Graph Beta API Error:', error.response?.data || error.message);
        throw error;
      }
    }

    return allData;
  }

  async batchDelete(endpoint, accessToken, ids) {
    const deletePromises = ids.map(id => 
      this.callMsGraph(`${endpoint}/${id}`, accessToken, 'DELETE')
    );
    
    return await Promise.allSettled(deletePromises);
  }
}

export default new GraphService();
