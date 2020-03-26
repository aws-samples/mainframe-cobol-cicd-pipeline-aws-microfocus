WScript.StdOut.WriteLine "Connecting Rumba session..."
sessType = Conn_3270
Set app = CreateObject("MicroFocus.Rumba")
If app.GetSessionType(app.ActiveSessionID) = sessType Then
    Set session = app.GetSession(app.ActiveSessionID)
Else
    sessID = app.CreateSession(sessType)
    Set session = app.GetSession(sessID)
End if

session.HostName = "127.0.0.1"
session.Port = 5555
session.Connect()
WScript.StdOut.WriteLine "Session connected."

WScript.StdOut.WriteLine "Interacting with screens..."
WaitScreen "This is the Micro Focus ES/MTO region", DefaultConnectionTimeout, 1, 2, SearchOnlyAt, False, Empty, Empty
session.SendKey "Clear"
WaitScreenTimeout DefaultScreenTimeout
session.TypeText "bank"
session.SendKey "Enter"
WaitScreen "User id.....:", DefaultScreenDataTimeout, 10, 30, SearchOnlyAt, False, 10, 44
session.TypeText "b0001v"
session.SendKey "Enter"
WaitScreen "        **********************************            ", DefaultScreenDataTimeout, 2, 17, SearchOnlyAt, False, 8, 4
'WaitScreen "        MISMATCH************************            ", DefaultScreenDataTimeout, 2, 17, SearchOnlyAt, False, 8, 4
session.TypeText "/"
session.SendKey "Enter"
WaitScreen "450061494  ", DefaultScreenDataTimeout, 11, 8, SearchOnlyAt, False, 11, 3
session.TypeText "/"
session.SendKey "Enter"
WaitScreen "Scrn:", DefaultScreenDataTimeout, 1, 2, SearchOnlyAt, False, Empty, Empty
session.SendKey "PF4"
WaitScreen "450061494  ", DefaultScreenDataTimeout, 11, 8, SearchOnlyAt, False, Empty, Empty
session.SendKey "Tab"
session.TypeText "/"
session.SendKey "Enter"
WaitScreen "Scrn:", DefaultScreenDataTimeout, 1, 2, SearchOnlyAt, False, Empty, Empty
session.SendKey "PF4"
WaitScreen "450061494  ", DefaultScreenDataTimeout, 11, 8, SearchOnlyAt, False, Empty, Empty
session.SendKey "PF4"
WaitScreen "        **********************************            ", DefaultScreenDataTimeout, 2, 17, SearchOnlyAt, False, Empty, Empty
session.SendKey "Tab"
session.SendKey "Tab"
session.SendKey "Tab"
session.TypeText "/"
session.SendKey "Enter"
WaitScreen "The amount you would like to borrow...:", DefaultScreenDataTimeout, 8, 6, SearchOnlyAt, False, 8, 46
session.TypeText "10000"
session.SendKey "Tab"
session.TypeText "4.25"
session.SendKey "Tab"
session.TypeText "24"
session.SendKey "Enter"
WaitScreen "The amount you would like to borrow...:", DefaultScreenDataTimeout, 8, 6, SearchOnlyAt, False, Empty, Empty
session.SendKey "PF4"
WaitScreen "        **********************************            ", DefaultScreenDataTimeout, 2, 17, SearchOnlyAt, False, Empty, Empty
session.SendKey "PF4"
WaitScreen "User id.....:", DefaultScreenDataTimeout, 10, 30, SearchOnlyAt, False, Empty, Empty
session.SendKey "PF3"
WaitScreenTimeout DefaultScreenTimeout
WScript.StdOut.WriteLine "Screen interactions completed."

session.Disconnect()
WScript.StdOut.WriteLine "Session disconnected."

lResult = CreateObject("WScript.Shell").Run("taskkill /f /im RumbaPage.exe", 0, True)
WScript.StdOut.WriteLine "Rumba process killed."
WScript.StdOut.WriteLine "BANKDEMO TESTS COMPLETED WITH SUCCESS"

Const DefaultScreenTimeout = 3000
Const DefaultScreenDataTimeout = 10000
Const DefaultConnectionTimeout = 10000

Const SearchAnywhere = 0
Const SearchStartingAt = 1
Const SearchOnlyAt = 2

Const ErrorCodeScreenTimeout = 1
Const ErrorCodeSessionDisconnected = 2
Const ErrorCodeHostBusy = 3

Const Conn_3270 = 1
Const Conn_5250 = 2
Const Conn_VAX = 3
Const Conn_Other = 4

Function GetScreenPosition(row, column)
    Dim rows
    Dim columns
    session.GetScreenSize rows, columns
    GetScreenPosition = (columns*(row-1)) + column
End Function

Function ScreenMatch(textToSearch, row, column, searchCriteria, ignoreCase)
    screenPosition = 1
    If (searchCriteria = SearchStartingAt Or searchCriteria = SearchOnlyAt) And Not IsEmpty(row) And Not IsEmpty(column) Then
        screenPosition = GetScreenPosition(row, column)
    End if

    If (searchCriteria = SearchStartingAt Or searchCriteria = SearchOnlyAt) And (IsEmpty(row) Or IsEmpty(column)) Then
        Dim currentRow
        Dim currentColumn
        session.GetCursorPosition currentRow, currentColumn
        If (searchCriteria = SearchStartingAt) Then currentColumn = 1
        screenPosition = GetScreenPosition(currentRow, currentColumn)
    End if
    
    textToSearchTemp = textToSearch
    screenTextTemp = session.ScreenText
    If ignoreCase = True Then
        textToSearchTemp = UCase(textToSearchTemp)
        screenTextTemp = UCase(screenTextTemp)
    End if
    
    If searchCriteria = SearchOnlyAt Then
        ScreenMatch = Mid(screenTextTemp, screenPosition, Len(textToSearchTemp)) = textToSearchTemp
    Else
        ScreenMatch = InStr(screenPosition, screenTextTemp, textToSearchTemp) <> 0
    End if
End Function

Sub WaitScreen(textToSearch, timeout, row, column, searchCriteria, ignoreCase, cursorPosRowToWait, cursorPosColumnToWait)
    Dim timePassed
    Dim screenFound
    Dim cursorPosMatch
    Dim cursorRow, cursorColumn
    timePassed = 0
		
    Do
        WScript.Sleep 100
        timePassed = timePassed + 100
        screenFound = ScreenMatch(textToSearch, row, column, searchCriteria, ignoreCase)
        If IsEmpty(cursorPosRowToWait) Or IsEmpty(cursorPosColumnToWait) Then
            cursorPosMatch = True
        Else
            session.GetCursorPosition cursorRow, cursorColumn
            cursorPosMatch = (cursorRow = cursorPosRowToWait And cursorColumn = cursorPosColumnToWait)
        End If
    Loop Until (session.HostReady = True And screenFound = True And cursorPosMatch = True) Or timePassed >= timeout
    
    If session.Connected = False Then Call Quit(ErrorCodeSessionDisconnected)
    If session.HostReady = False Then Call Quit(ErrorCodeHostBusy)
    If screenFound = False Then Call Quit(ErrorCodeScreenTimeout)
End Sub

Sub WaitScreenTimeout(timeout)
    Dim timePassed
    timePassed = 0

    Do
        WScript.Sleep 100
        timePassed = timePassed + 100
    Loop Until timePassed >= timeout

    If session.Connected = False Then Call Quit(ErrorCodeSessionDisconnected)
    If session.HostReady = False Then Call Quit(ErrorCodeHostBusy)
End Sub

Function PromptForHiddenText(prompt, caption)
    Set objHiddenText = CreateObject( "MicroFocus.HiddenInput" )
    txt = objHiddenText.GetInput(prompt, caption)
    If txt = Empty Then WScript.Quit
    PromptForHiddenText = txt
End Function

Sub Quit(ErrorCode)
    If ErrorCode = ErrorCodeScreenTimeout Then WScript.StdErr.Write "ERROR - Screen timeout or screen mismatch."
    If ErrorCode = ErrorCodeSessionDisconnected Then WScript.StdErr.Write "ERROR - Session disconnected."
    If ErrorCode = ErrorCodeHostBusy Then WScript.StdErr.Write "ERROR - Host busy."

    WScript.Quit
End Sub

