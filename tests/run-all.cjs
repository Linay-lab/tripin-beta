const {spawnSync}=require('child_process'),path=require('path');let failed=false;
for(const script of ['source-audit.cjs','production-readiness.cjs','gps-reminders.cjs','full-site.cjs','tripin-beta.cjs']){const result=spawnSync(process.execPath,[path.join(__dirname,script)],{stdio:'inherit',env:process.env});if(result.status!==0)failed=true}
require('./build-report.cjs');if(failed)process.exitCode=1;
