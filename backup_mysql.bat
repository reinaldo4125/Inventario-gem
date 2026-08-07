@echo off
set FECHA=%DATE:~10,4%-%DATE:~4,2%-%DATE:~7,2%_%TIME:~0,2%%TIME:~3,2%
set FECHA=%FECHA: =0%
mysqldump -u root -pSalome2016. NOMBRE_BD > "C:\backups\backup_%FECHA%.sql"
