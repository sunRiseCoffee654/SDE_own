$env:JAVA_HOME = "C:\Users\hp\Downloads\sde-orbit\.tools\jdk21\jdk-21.0.12.1+1"
$env:ANDROID_HOME = "C:\Users\hp\Downloads\sde-orbit\.tools\android-sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

Write-Output "JAVA_HOME is: $env:JAVA_HOME"
Write-Output "ANDROID_HOME is: $env:ANDROID_HOME"

Set-Location "android"
.\gradlew.bat assembleDebug

if ($LASTEXITCODE -eq 0) {
    Set-Location ..
    Copy-Item "android\app\build\outputs\apk\debug\app-debug.apk" "sde-orbit-debug.apk" -Force
    Copy-Item "android\app\build\outputs\apk\debug\app-debug.apk" "orbit-debug.apk" -Force
    Write-Output "APK generated successfully and copied to sde-orbit-debug.apk and orbit-debug.apk"
    Get-Item "orbit-debug.apk" | Select-Object Name, Length, LastWriteTime
} else {
    Write-Error "Gradle build failed with exit code $LASTEXITCODE"
}

