param([int]$TargetPid, [string]$ImageFilePath, [ValidateSet('Save','KeepEditing')][string]$Action='Save')
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$until = [DateTime]::UtcNow.AddSeconds(15)
$observed = @()
while ([DateTime]::UtcNow -lt $until) {
  $windows = [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty, $TargetPid)))
  foreach ($window in $windows) {
    if ($Action -eq 'KeepEditing') {
      $message = $window.FindFirst([System.Windows.Automation.TreeScope]::Descendants, (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty,'MainInstruction')))
      if (-not $message) { continue }
      if ($message.Current.Name -notmatch '图片.*未保存') { throw ('Missing image exit warning: '+$message.Current.Name) }
      $keep = $window.FindFirst([System.Windows.Automation.TreeScope]::Descendants, (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty,'CommandButton_100')))
      $keep.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
      [Console]::Out.Write('native-image-warning-keep-editing')
      exit 0
    }
    $hostField = $window.FindFirst([System.Windows.Automation.TreeScope]::Descendants, (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, 'FileNameControlHost')))
    if (-not $hostField) { continue }
    $filename = $hostField.FindFirst([System.Windows.Automation.TreeScope]::Descendants, (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, '1001')))
    if (-not $filename) { continue }
    $dialogs = $window.FindAll([System.Windows.Automation.TreeScope]::Descendants, (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Window)))
    $dialog = @($dialogs | Where-Object { $_.Current.Name -eq '另存为' -or $_.Current.Name -eq 'Save As' }) | Select-Object -First 1
    if (-not $dialog -and ($window.Current.Name -eq '另存为' -or $window.Current.Name -eq 'Save As')) { $dialog=$window }
    if (-not $dialog) { throw 'Known native save dialog ancestor missing' }
    $imageSaveMatches = @($dialog.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition) | Where-Object { $_.Current.ControlType.ProgrammaticName -eq 'ControlType.Button' -and $_.Current.AutomationId -eq '1' -and $_.Current.Name -match '保存|Save' })
    if ($imageSaveMatches.Count -ne 1) { throw ('Expected one known native save Button; actual='+$imageSaveMatches.Count) }
    $save = $imageSaveMatches[0]
    $filename.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).SetValue($ImageFilePath)
    $save.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
    [Console]::Out.Write('selected-native-save-target')
    exit 0
  }
  Start-Sleep -Milliseconds 100
}
throw ('Owned image dialog not found for action '+$Action)
