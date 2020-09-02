#!/bin/bash

./fix_pb.sh ./lib/generated/*_pb.js

if grep -qrE "[^a-zA-Z]Function\(" lib; then
  echo "Error: Function( still present"
  exit -1
fi

if grep -qrE "\(.google-protobuf" lib; then
  echo "Error: google-protobuf still present"
  exit -1
fi

if grep -qrE '(^|[^a-zA-Z."])global([^a-zA-Z]|$)' lib; then
  echo "Error: global still present"
  exit -1
fi

if grep -qrE '@grpc/grpc-js' lib; then
  echo "Error: @grpc/grpc-js still present"
  exit -1
fi

echo "./lib patched!"
