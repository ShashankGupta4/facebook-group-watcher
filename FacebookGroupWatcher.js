var maxPostsToScan = 3;

function getGroupPostContent(postIndex)
{
	var macro = "CODE:";
	macro += "TAG POS=" + postIndex.toString() + " TYPE=DIV ATTR=CLASS:*userContent*&&DATA-FT:*tn* EXTRACT=TXT";

	var retVal = iimPlay(macro);
	if (retVal === -101)
	{
		return "#ABORT#";
	}
	else if (retVal < 0)
	{
		iimDisplay("Error while scraping a group post: " + iimGetErrorText());
	}

	return iimGetExtract().trim();
}

function loadGroups()
{
	var macro;
	var retVal;
	var groups = [];
	for (var i = 1; i <= 1000; i++)
	{
		macro = "CODE:";
		macro += "SET !DATASOURCE Groups.csv\n";
		macro += "SET !EXTRACT {{!COL" + i + "}}";

		retVal = iimPlay(macro);
		if (retVal === -101)
		{
			return "#ABORT#";
		}
		else if (retVal < 0)
		{
			iimDisplay("Error while reading the group url: " + iimGetErrorText());
			break;
		}

		groups[i] = iimGetExtract().trim();
	}

	return groups;
}

function loadKeywords()
{
	var macro;
	var retVal;
	var keywords = [];
	for (var i = 1; i <= 1000; i++)
	{
		macro = "CODE:";
		macro += "SET !DATASOURCE Keywords.csv\n";
		macro += "SET !EXTRACT {{!COL" + i + "}}";

		retVal = iimPlay(macro);
		if (retVal === -101)
		{
			return "#ABORT#";
		}
		else if (retVal < 0)
		{
			iimDisplay("Error while reading the keyword: " + iimGetErrorText());
			break;
		}

		keywords[i] = iimGetExtract();
	}

	return keywords;
}

function checkForKeywords(postContent, keywords)
{
	for (var i = 1; i < keywords.length; i++)
	{
		if (keywords[i].length === 0)
			continue;

		if (postContent.indexOf(keywords[i]) != -1)
		{
			return true;
		}
	}

	return false;
}

function openGroup(groupUrl)
{
	var macro = "CODE:";
	macro += "URL GOTO=" + groupUrl + "\n";

	var retVal;
	for (var i = 0; i < 20; i++)
	{
		retVal = iimPlay(macro);		
		if (retVal === -101)
		{
			return "#ABORT#";
		}
		else if (retVal < 0)
		{
			iimDisplay("Error while loading the target page: " + iimGetErrorText() + "\n\nRetrying...");
		}
		else
		{
			return;
		}
	}

	iimDisplay("Unable to load the target page after 10 tries.");
	return "#ABORT#";
}

function deleteGroupPost(postIndex)
{
	var macro = "CODE:";
	macro += "SET !TIMEOUT_STEP 10\n";
	macro += "TAG POS=" + postIndex.toString() + " TYPE=A ATTR=ROLE:button&&ARIA-LABEL:Story<SP>options\n";
	macro += "TAG XPATH=\"//div[@class='uiContextualLayerPositioner uiLayer']//li//span/span[text()='Delete Post']\"\n";
	macro += "TAG POS=1 TYPE=BUTTON FORM=ACTION:/ajax/groups/mall/delete.php ATTR=TXT:Delete\n";
	macro += "WAIT SECONDS=3";

	var retVal = iimPlay(macro);
	if (retVal === -101)
	{
		return "#ABORT#";
	}
	else if (retVal < 0)
	{
		iimDisplay("Error while deleting a group post: " + iimGetErrorText());
	}
}

function runWatcher()
{
	var keywords = loadKeywords();
	if (keywords === "#ABORT#")
	{
		iimDisplay("Operation aborted.");
		return;
	}
	else if (keywords.length === 0)
	{
		iimDisplay("No keyword found. Aborting...");
		return;
	}

	var groups = loadGroups();
	if (groups === "#ABORT#")
	{
		iimDisplay("Operation aborted.");
		return;
	}
	else if (groups.length === 0)
	{
		iimDisplay("No group found. Aborting...");
		return;
	}

	// Max allowed tries to retrieve a post content.
	var maxTries = 3;
	var currTries = 1;

	var retVal;
	for (var j = 1; j < groups.length; j++)
	{
		var currGroupUrl = groups[j];

		if (currGroupUrl.length === 0)
		{
			continue;
		}

		iimDisplay("Scanning group: " + currGroupUrl);

		retVal = openGroup(groups[j]);
		if (retVal === "#ABORT#")
		{
			iimDisplay("Operation aborted.");
			return;
		}
		
		// Reset the counter.
		currTries = 1;

		var deletedPostsCount = 0;

		// Scanning each post.
		for (var i = 1; i <= maxPostsToScan; i++)
		{
			var correctPostIndex = i - deletedPostsCount;

			var content = getGroupPostContent(correctPostIndex);
			if (content === "#ABORT#")
			{
				iimDisplay("Operation aborted.");
				return;
			}
			else if (content === "#EANF#")
			{
				// Unable to find the target post. Scrolling downwards to load more posts.

				if (currTries >= maxTries)
				{
					iimDisplay("Unable to load the target post after " + maxTries + " tries. Reached the end of the group.\nJob finished!");
					break;
				}

				window.scrollBy(0, 20000);
				
				i--;
				currTries++;

				continue;
			}

			// Reset the counter after successful scrape.
			currTries = 1;

			// Check if the post contains a specified keyword
			if (checkForKeywords(content, keywords))
			{
				// Perform appropriate action.

				//alert("Keyword(s) detected: " + content);

				deleteGroupPost(correctPostIndex);

				// Update the count.
				deletedPostsCount++;
			}
		}
	}

	
}

runWatcher();