-- below is a list of snippets from the game I work in:

-- function for distributing funds in an organization
local Functions = {
  	DistributeFunds = function(Player, Data)
  		local Action = Data["Type"] -- gets the intended action 
  		local Players_ = Data["Players"] -- gets the selected players to distribute the funds to (selected via a GUI)
  		local Amount = Data["Amount"] -- gets the given amount
  		
  		local PlayerCount = 0
  		for _,v in pairs(Players_) do -- gets the amount of players to distribute the funds to
  			PlayerCount = PlayerCount + 1
  		end
  
  		Amount = tonumber(Amount) -- verifies that the amount is a number
  		if Amount == nil then return {err = "amount not number"} end
  		if Amount < 0 then return { err = "amount can not be negative" } end -- prevents users from entering negative amounts to avoid a double substraction (addition)
  		
  		local Membership = _G.Orgs.GetOrgMembership(Player.UserId, true) -- retrieves the organization membership data of the person that is invoking the function
  		local Funds = tonumber(Membership["Data"]["Funds"]) -- gets the organization's funds
  		
  		if Action == "Split" or Action == "Transfer" then -- if the action/operation is either Split or Transfer, it checks if the given amount is lower or equal to the current funds
  			if Amount > Funds then return { err = "amount > funds" } end
  		end
  		
  		local PlayerDataFolder = game.ReplicatedStorage.Data 
  		
  		if Membership["Data"]["Role"] ~= "Leader" then return {err = " bad role "} end -- if the person who is invoking the function isn't the leader, it does not allow them to distribute the funds
  			
  		if PlayerCount > 0 then
  			if Action == "Split" then -- handles splitting the funds across all the selected players
  				local SplitAmount = math.floor(Amount / PlayerCount) -- divides the amount by the amount of players to get the amount for each player
  				local TotalAmount = SplitAmount * PlayerCount  -- total amount based on the multiplication of the split amount by player amount (to get a precise amount as math.floor() was used)
  				
  				for PUSID,_ in pairs(Players_) do -- loops through each player
  					local PlayerData = PlayerDataFolder:FindFirstChild(PUSID) -- retrives the user's data folder
  					PlayerData.Bank.Value = PlayerData.Bank.Value + SplitAmount -- updates their Bank value in their data folder
  					_G.PlayerDataCache[tonumber(PUSID)]["Bank"] = PlayerData.Bank.Value -- updates the player data cache (used for decreasing load times and database stress)
  				end
  				
  				Organizations[Membership["OrgName"]]["Funds"] = Funds - TotalAmount -- removes the total amount given away from the organization funds
  				
  				SynchronizeData(Membership["OrgName"], { -- synchronizes the Funds variable between all active servers (using MessagingService)
  					["Funds"] = Organizations[Membership["OrgName"]]["Funds"]
  				})
  				ForceTableSave(Player, Membership["OrgName"]) -- forces a save to the database to prevent any data loss
  				return { -- returns a successful operation
  					success = true;
  					msg = "";
  					newFunds = Organizations[Membership["OrgName"]]["Funds"]
  				}
  			end
  			if Action == "Transfer" then -- handles transferring
  				local TotalAmount = Amount * PlayerCount -- multiplies the amount by player count to get the total amount
  				if TotalAmount > Funds then return {err = "" } end
  				
  				for PUSID,_ in pairs(Players_) do -- loops through every player and updates their data
  					local PlayerData = PlayerDataFolder:FindFirstChild(PUSID)
  					PlayerData.Bank.Value = PlayerData.Bank.Value + Amount
  					_G.PlayerDataCache[tonumber(PUSID)]["Bank"] = PlayerData.Bank.Value
  				end
  				
  				Organizations[Membership["OrgName"]]["Funds"] = Funds - TotalAmount -- subtracts the funds from the organization funds
  				SynchronizeData(Membership["OrgName"], { -- synchronizes data between all servers
  					["Funds"] = Organizations[Membership["OrgName"]]["Funds"]
  				})
  				ForceTableSave(Player, Membership["OrgName"]) -- updates database
  				return { 
  					success = true;
  					msg = "";
  					newFunds = Organizations[Membership["OrgName"]]["Funds"]
  				}
  			end
  		end
  			if Action == "Deposit" then -- handles depositing from the user's bank
  				local PlayerData = PlayerDataFolder:FindFirstChild(Player.UserId) -- retrives user data
  				local PlayerBank = PlayerData.Bank.Value -- retrieves bank funds
  				
  				if Amount <= PlayerBank then -- if the amount is lower or equal to the user's bank funds continue
  					local NewBankBalance = math.floor(PlayerBank - Amount) -- gets the actual new bank balance
  					PlayerData.Bank.Value = NewBankBalance
  					_G.PlayerDataCache[tonumber(Player.UserId)]["Bank"] = NewBankBalance -- updates data cache with new bank amount
  					Organizations[Membership["OrgName"]]["Funds"] = math.floor(Funds + Amount)
  					SynchronizeData(Membership["OrgName"], { -- synchronizes data across all servers
  						["Funds"] = Organizations[Membership["OrgName"]]["Funds"]
  					})
  					ForceTableSave(Player, Membership["OrgName"])
  					return {
  						success = true;
  						msg = "";
  						newFunds = Organizations[Membership["OrgName"]]["Funds"]
  					}
  				else
  					return {err = ""}
  				end
  			end
	end
}

--------------------------------------------------------------[ SEPERATE SCRIPT ]----------------------------------------------------------------------------------------------------

-- Automatic license plate reading system (ALPR) for law enforcement vehicles (localscript)
local car = script.Parent.Parent.Car.Value -- gets the car model (A-Chassis)
local gui = script.Parent -- gets the ALPR interface
local LookupPlate = game.ReplicatedStorage:FindFirstChild("Functions"):FindFirstChild("LookupPlate") -- gets the function for looking up a plate (handled by the server)

-- initalizes the plate readers as empty plates
gui.FRONT.TextLabel.Text = "" 
gui.REAR.TextLabel.Text = ""

local readPlate = function() -- function which uses raycasting to get a plate of the vehicle in front or behind
  -- references to the law enforcement vehicle (raycasting is done using the front and back plates as it's a post-release system, it is done this way to ensure compatibility with every LE vehicle)
	local FrontRefPoint = car.Body:FindFirstChild("Plates"):FindFirstChild("Front") 
	local AftRefPoint = car.Body:FindFirstChild("Plates"):FindFirstChild("Rear")
	if FrontRefPoint and AftRefPoint then
    -- sets collision groups of the plates to ignore any unwanted raycast hits
		FrontRefPoint.CollisionGroup = "ALPR" 
		AftRefPoint.CollisionGroup = "ALPR"

    -- retrives the plates' origin and the direction based on the LookVector of the plate CFrame with a range of 100 studs
		local FrontOrigin = FrontRefPoint.Position
		local FrontDirection = FrontRefPoint.CFrame.LookVector * 100
		local AftOrigin = AftRefPoint.Position
		local AftDirection = AftRefPoint.CFrame.LookVector * 100

    -- creates new raycasting parameters
		local params = RaycastParams.new()
		params.CollisionGroup = "ALPR"

    -- performs the raycast operations
		local FrontCast = workspace:Raycast(FrontOrigin, FrontDirection, params)
		local AftCast = workspace:Raycast(AftOrigin, AftDirection, params)

		if FrontCast and FrontCast.Instance then -- if the raycast emitted from the front plate hits another object with the ALPR collision group, it performs operations on the hit vehicle
			local VehicleReference = FrontCast.Instance.Parent.Parent -- retrives the vehicle model (the hierarchy is always the same)
			local Plate = VehicleReference.Information.Plate.Value -- retrives the plate of the vehicle in front

			if Plate ~= gui.FRONT.TextLabel.Text then -- if the new plate isn't equal as the plate being currently displayed, it resets the color to the default one
				gui.FRONT.TextLabel.TextColor3 = Color3.fromRGB(10, 119, 202)
			end

			local Result = LookupPlate:InvokeServer(game.Players.LocalPlayer, Plate) -- looks up plate
			local Plr = game.Players:GetUserIdFromNameAsync(Result[1]) -- gets player id using the username returned by the plate lookup 
			local PlayerData = game.ReplicatedStorage.Data[Plr] -- retrieves the player data using their user id 

			if (PlayerData.Wanted.Value == true or PlayerData.MiscVariables.BOLO.Value == true) and gui.FRONT.TextLabel.Text ~= Plate then -- if the owner of the vehicle is wanted and the current displayed plate isn't the new plate, it highlights the plate on the GUI and lets off a beeping sound
				script.Sound:Play()
				coroutine.wrap(function()
					gui.FRONT.TextLabel.TextColor3 = Color3.fromRGB(255, 0, 0)
					wait(0.7)
					gui.FRONT.TextLabel.TextColor3 = Color3.fromRGB(10, 119, 202)
					wait(0.7)
					gui.FRONT.TextLabel.TextColor3 = Color3.fromRGB(255, 0, 0)
					wait(0.7)
					gui.FRONT.TextLabel.TextColor3 = Color3.fromRGB(10, 119, 202)
					wait(0.7)
					gui.FRONT.TextLabel.TextColor3 = Color3.fromRGB(255, 0, 0)
					wait(0.7)
					gui.FRONT.TextLabel.TextColor3 = Color3.fromRGB(10, 119, 202)
					wait(0.7)
					gui.FRONT.TextLabel.TextColor3 = Color3.fromRGB(255, 0, 0)
				end)()
			end


			gui.FRONT.TextLabel.Text = Plate -- updates the gui with the new plate
		end

		if AftCast and AftCast.Instance then -- works on the same principle as above, just using the rear plate instead of the front one
			local VehicleReference = AftCast.Instance.Parent.Parent
			local Plate = VehicleReference.Information.Plate.Value

			if Plate ~= gui.REAR.TextLabel.Text then
				gui.REAR.TextLabel.TextColor3 = Color3.fromRGB(10, 119, 202)
			end

			local Result = LookupPlate:InvokeServer(game.Players.LocalPlayer, Plate)
			local Plr = game.Players:GetUserIdFromNameAsync(Result[1])
			local PlayerData = game.ReplicatedStorage.Data[Plr]

			if (PlayerData.Wanted.Value == true or PlayerData.MiscVariables.BOLO.Value == true) and gui.REAR.TextLabel.Text ~= Plate then
				script.Sound:Play()
				coroutine.wrap(function()
					gui.REAR.TextLabel.TextColor3 = Color3.fromRGB(255, 0, 0)
					wait(0.7)
					gui.REAR.TextLabel.TextColor3 = Color3.fromRGB(10, 119, 202)
					wait(0.7)
					gui.REAR.TextLabel.TextColor3 = Color3.fromRGB(255, 0, 0)
					wait(0.7)
					gui.REAR.TextLabel.TextColor3 = Color3.fromRGB(10, 119, 202)
					wait(0.7)
					gui.REAR.TextLabel.TextColor3 = Color3.fromRGB(255, 0, 0)
					wait(0.7)
					gui.REAR.TextLabel.TextColor3 = Color3.fromRGB(10, 119, 202)
					wait(0.7)
					gui.REAR.TextLabel.TextColor3 = Color3.fromRGB(255, 0, 0)
				end)()
			end

			gui.REAR.TextLabel.Text = Plate
		end
	end
end

while wait(0.3) do -- it checks for new plates every 0.3 seconds (only executes when the user is in the vehicle)
	readPlate()
end
