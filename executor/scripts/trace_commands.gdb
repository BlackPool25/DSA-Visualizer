# GDB command script for collecting execution traces
# Usage: gdb -batch -x trace_commands.gdb --args ./program

# Set up environment
set pagination off
set confirm off
set print null-stop

# Set output file from environment or use default
set $trace_output = "trace.json"
if $_ getenv("TRACE_OUTPUT") != ""
  set $trace_output = $_ getenv("TRACE_OUTPUT")
end

set $max_steps = 1000
if $_ getenv("TRACE_MAX_STEPS") != ""
  set $max_steps = (int)$_ getenv("TRACE_MAX_STEPS")
end

# Initialize trace array (we'll build JSON manually)
set $step_count = 0
set $trace_started = 0

# Function to capture a trace step
define capture_step
  # Get current location
  set $cur_line = $_line
  set $cur_file = $_filename
  
  # Print trace info
  printf "Step %d: %s:%d\n", $step_count, $cur_file, $cur_line
  
  # Increment step counter
  set $step_count = $step_count + 1
end

# Set breakpoint at main and start
break main
run

# Main stepping loop
while $step_count < $max_steps
  # Capture current state
  capture_step
  
  # Try to step
  step
  
  # Check if program exited
  if $_isvoid($_exitcode) == 0
    printf "Program exited with code %d\n", $_exitcode
    loop_break
  end
end

printf "Trace complete: %d steps captured\n", $step_count
