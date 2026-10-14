// Deploy as an Apps Script Web App under the spreadsheet owner's account.
// Set Script Properties SYNKRA_SECRET and SYNKRA_SPREADSHEET_ID before deployment.
// The protected SYNKRA server calls this URL; the browser never receives the secret.
function doPost(event) {
  var lock=LockService.getScriptLock();
  try {
    var input=JSON.parse(event.postData.contents);
    var properties=PropertiesService.getScriptProperties();
    var expected=properties.getProperty('SYNKRA_SECRET');
    if(!expected||input.secret!==expected||['users','leads','orders'].indexOf(input.kind)<0)throw new Error('Unauthorized');
    var data=Utilities.parseCsv(String(input.csv).replace(/^\uFEFF/,''));
    if(!data.length||data.length>50000)throw new Error('Invalid dataset');
    lock.waitLock(20000);
    var book=SpreadsheetApp.openById(properties.getProperty('SYNKRA_SPREADSHEET_ID'));
    var name='SYNKRA_'+input.kind;
    var sheet=book.getSheetByName(name)||book.insertSheet(name);
    sheet.clearContents();
    sheet.getRange(1,1,data.length,data[0].length).setNumberFormat('@').setValues(data);
    sheet.setFrozenRows(1);
    return ContentService.createTextOutput(JSON.stringify({ok:true,rows:data.length-1})).setMimeType(ContentService.MimeType.JSON);
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({ok:false,error:'Export failed'})).setMimeType(ContentService.MimeType.JSON);
  } finally { if(lock.hasLock())lock.releaseLock(); }
}
