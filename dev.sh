(sleep 2; touch bion.js) &
while inotifywait -e modify,close_write,move_self -q *.js
do 
  kill `cat .pid`
  sleep 0.1
  clear
  FASTBENCH=true node bench.js $@ &
  echo $! > .pid
  sleep 3
done

