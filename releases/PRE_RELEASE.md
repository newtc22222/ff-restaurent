# Planning

## Common

- Update label display on UI:
  - CUSTOMER - Customer
  - HEAD_CHEF - Executive chef
  - SOUS_CHEF - Sous chef
- Support theme: light/dark/system. Default is system
- Keep the Sidebar on the left of page
- Now all feature will show on container
- Move User's name, role and button Sign out to the right side of Header
- Add "Vietnamese" to current app and allow user to switch language, default language now is Vietnamese (Tiếng Việt)
- Add currency "vnd" to current app, default currency now is vnd

## Authentication

- Show the highest role of User on UI
- Confirm when Sign out
- Using phone/username instead of email to login
- User can register account with phone, username, password. Default role of them is CUSTOMER
- Add View profile and Edit profile for user

## Bills

- Hide filter member from CUSTOMER
- Add filter Paid/Unpaid for CUSTOMER
- CUSTOMER can see only list bill of them. Allow them View Detail.
- CUSTOMER can only mark paid for themselves
- CUSTOMER can open a QR Code that SOUS_CHEF or HEAD_CHEF provide to pay
- Hide archive when user is SOUS_CHEF
- Hide button archive/restore following the status of bill
- Confirm when archive or restore
- HEAD_CHEF and SOUS_CHEF can add the QR code to the bill
- Add feature edit bill. The bill can only be updated by the person who created it
- Add chart to view percentage in bill

## Restaurants/Eatery

- Add avatar for restaurant/eatery
- Add links (allow multiples) for restaurant/eatery
- Add sort by Name
- Add filter by Food type
- Add filter by Favorite/Recommend
- Allow CUSTOMER View Detail of Restaurant/Eatery
- Add icon button to add to favorite on the card
- Add icon button to add to favorite on detail page
- Add icon button to add to recommend on detail page for SOUS_CHEF and HEAD_CHEF
- Make a dropdown for Cuisine type and allow multiple choices. Add samples that popular in Vietname (use Vietnamese when lang is Vietnamese)
- Make a dropdown for Type
- Add validation for all fields

### Future

- All user can rating from 1 to 5 stars for their experience in that day (Food, Service). System will calculate the average star for the Restaurant/Eatery
- Add list to view the rating figure

## Stats

- Add chart to view the spending in week/month/year
- Add statistic for frequency of food, restaurant

## Notification

- Hide temporary for all roles
