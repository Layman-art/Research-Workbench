on run argv
  set prefix to item 1 of argv
  tell application "System Events"
    tell process "research-workbench"
      set allEls to entire contents of window 1
      repeat with b in allEls
        try
          if (role of b is "AXButton") and ((name of b) starts with prefix) then
            click b
            exit repeat
          end if
        end try
      end repeat
    end tell
  end tell
end run