#!/bin/bash
# -------------------------------------
# MyRealm Multi-Visitor Web-VR Server Launch Script
# Author: Bryan "ObsidianBlk" Miller
# -------------------------------------

# The server will output various debugging information if the DEBUG environment variable is defined. Uncomment the line below to enable
# debugging from all MyRealm components.
export DEBUG=myrealm:*

# By default, MyRealm will load the server.config.json file located in the room MyRealm path. Optionally, an alternate path can be specified
# with the MYREALM_CONFIG_PATH environment variable. To use an alternate configuration file, uncomment the line below and set the path to the
# full path to the configuration file you want the server to use.
#export MYREALM_CONFIG_PATH=/path/to/myrealm/server.config.json


# Now running the server.
node .

