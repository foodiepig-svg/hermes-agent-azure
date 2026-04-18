#!/bin/bash
echo "[startup] Starting at $(date)" >> /tmp/startup.log
echo "[startup] HERMES_HOME=$HERMES_HOME" >> /tmp/startup.log
echo "[startup] PYTHONPATH=$PYTHONPATH" >> /tmp/startup.log
echo "[startup] Contents of /app:" >> /tmp/startup.log
ls -la /app/ >> /tmp/startup.log 2>&1
echo "[startup] Contents of /root/.hermes:" >> /tmp/startup.log
ls -la /root/.hermes/ >> /tmp/startup.log 2>&1
echo "[startup] Contents of /root/.hermes/hermes-agent:" >> /tmp/startup.log
ls -la /root/.hermes/hermes-agent/ >> /tmp/startup.log 2>&1
echo "[startup] Python path:" >> /tmp/startup.log
python -c "import sys; print(sys.path)" >> /tmp/startup.log 2>&1
echo "[startup] Trying import gateway:" >> /tmp/startup.log
python -c "import gateway; print('gateway OK')" >> /tmp/startup.log 2>&1
echo "[startup] Gateway module:" >> /tmp/startup.log
python -c "import gateway; print(gateway.__file__)" >> /tmp/startup.log 2>&1
echo "[startup] Starting gateway at $(date)" >> /tmp/startup.log
python -m gateway.run >> /tmp/startup.log 2>&1 &
GATEWAY_PID=$!
echo "[startup] Gateway PID: $GATEWAY_PID" >> /tmp/startup.log
sleep 5
if kill -0 $GATEWAY_PID 2>/dev/null; then
    echo "[startup] Gateway still running after 5s" >> /tmp/startup.log
else
    echo "[startup] Gateway died!" >> /tmp/startup.log
fi
wait $GATEWAY_PID
echo "[startup] Gateway exited with code $? at $(date)" >> /tmp/startup.log