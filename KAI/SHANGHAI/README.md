# Shanghai Ranking Lists To CSV
Saves Shanghat GRAS and ARWU lists as CSV. GRAS includes all fields and subjects.

## Installation
You need [Node](https://nodejs.org) to be installed on your machine.  
Install necessary modules by runing `npm install`. 

## Running
Run `node main.js [year] [list]` where you replace [year] with what year you want to download and [list] with the selection of arwu, gras or both i.e. `node main 2022 both` which will save two files `shanghai-arwu-[year].csv` and `shanghai-gras-[year].csv` in the current directory.