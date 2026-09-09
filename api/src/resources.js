export const resources = {
  leads: { required: ['name'], fields: {name:'text',company:'text',email:'email',phone:'text',source:'text',status:['New leads','Contacted','Interested','Proposal','Closed','Lost','Ringing'],estimated_value:'money',notes:'long',platform:['Facebook','Instagram','Website'],city:'text',budget:'text',service:'text',timeline:'text',owner:'text',follow_up:['No follow-up','Due Today','Overdue','Upcoming (7d)'],temperature:'text'} },
  clients: {required:['name'],fields:{name:'text',industry:'text',email:'email',phone:'text',type:['Retainer','Project'],status:['Onboarding','Active','Inactive'],monthly_value:'money'}},
  projects:{required:['client_id','name'],fields:{client_id:'id',name:'text',description:'long',status:['Not started','In progress','On hold','Completed'],progress:'progress',start_date:'date',due_date:'date',monthly_value:'money'}},
  tasks:{required:['title'],fields:{project_id:'nullableId',assignee_id:'nullableId',title:'text',description:'long',status:['Not started','Pending','In progress','Completed'],priority:['low','medium','high'],due_date:'date',client_name:'text',assignee_name:'text'}},
  invoices:{required:['client_id','invoice_number','amount'],fields:{client_id:'id',invoice_number:'text',amount:'money',status:['Draft','Pending','Paid','Overdue'],issue_date:'date',due_date:'date'}},
  users:{required:['name','email'],fields:{name:'text',email:'email',job_title:'text',status:['active','away','inactive'],phone:'text'}},
  agreements:{required:['client_id','title'],fields:{client_id:'id',title:'text',type:'text',status:['Draft','Sent','Active','Expired'],start_date:'date',end_date:'date',document_url:'text'}},
  reports:{required:['client_id'],fields:{client_id:'id',weekly_reports:'text',monthly_status:['Pending','Submitted'],health:['On Track','Delayed'],submitted_at:'date'}},
};
export function validate(resource, body, create = false) {
  if (!body || Array.isArray(body) || typeof body !== 'object') throw Object.assign(new Error('Expected a JSON object.'),{status:400});
  const output = {};
  for (const [key, kind] of Object.entries(resources[resource].fields)) {
    if (!(key in body)) continue;
    let value = body[key];
    const fail = () => {throw Object.assign(new Error(`Invalid ${key}.`),{status:400});};
    if (Array.isArray(kind)) { if (!kind.includes(value)) fail(); }
    else if (['id','nullableId','money','progress'].includes(kind)) {
      if (kind === 'nullableId' && (value === null || value === '')) value=null;
      else { if(value === '' || value === null || typeof value === 'boolean') fail(); value=Number(value); if(!Number.isFinite(value) || value<0 || ((kind==='id'||kind==='nullableId') && (!Number.isSafeInteger(value)||value<1)) || (kind==='progress' && (value>100||!Number.isInteger(value))))fail(); }
    } else if (kind==='date') {
      if(value===null||value==='')value=null;
      else if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)fail();
    } else { if(typeof value!=='string')fail();value=value.trim(); if(value.length>(kind==='long'?20000:190))fail();if(kind==='email'&&value&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))fail(); }
    output[key]=value;
  }
  for(const key of resources[resource].required)if((create || key in output) && (output[key]===undefined||output[key]===null||output[key]===''))throw Object.assign(new Error(`${key} is required.`),{status:400});
  if(!Object.keys(output).length)throw Object.assign(new Error('No valid fields supplied.'),{status:400});
  return output;
}
