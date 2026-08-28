document.getElementById('loginPassword').addEventListener('keydown',e=>{if(e.key==='Enter')loginRevibe()});
document.getElementById('newProductName').addEventListener('keydown',e=>{if(e.key==='Enter')saveNewProduct()});
document.getElementById('renterCreateName').addEventListener('keydown',e=>{if(e.key==='Enter')saveNewRenter()});
document.getElementById('treatmentCreateName').addEventListener('keydown',e=>{if(e.key==='Enter')saveNewTreatment()});
document.getElementById('sunbedLength').addEventListener('input',updateSunbedTotal);
bootRevibe();
setInterval(()=>{if(document.getElementById('bedtracker')?.classList.contains('active'))renderBedTracker()},60000);
