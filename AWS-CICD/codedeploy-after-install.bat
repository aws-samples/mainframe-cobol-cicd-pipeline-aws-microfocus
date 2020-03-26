copy  /b/v/y  .\dll-staging\*  C:\BankDemo\System\SysLoadlib
C:\"Program Files (x86)"\"Micro Focus"\"Enterprise Test Server"\bin\casstart /rBANKDEMO
ping 127.0.0.1 -n 30 -w 1000 > NUL