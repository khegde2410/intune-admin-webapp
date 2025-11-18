export const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
};

export const getDaysSinceLastSync = (lastSyncDateTime) => {
  if (!lastSyncDateTime) return null;
  const lastSync = new Date(lastSyncDateTime);
  const now = new Date();
  const diffTime = Math.abs(now - lastSync);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export const getComplianceColor = (state) => {
  switch (state?.toLowerCase()) {
    case 'compliant':
      return 'success';
    case 'noncompliant':
      return 'danger';
    case 'ingraceperiod':
      return 'warning';
    default:
      return 'secondary';
  }
};

export const downloadCSV = (data, filename) => {
  const csv = convertToCSV(data);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.setAttribute('hidden', '');
  a.setAttribute('href', url);
  a.setAttribute('download', filename);
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

const convertToCSV = (objArray) => {
  const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray;
  let str = '';
  const header = Object.keys(array[0]).join(',');
  str += header + '\r\n';
  
  for (let i = 0; i < array.length; i++) {
    let line = '';
    for (let index in array[i]) {
      if (line !== '') line += ',';
      line += array[i][index];
    }
    str += line + '\r\n';
  }
  return str;
};
