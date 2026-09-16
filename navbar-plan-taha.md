# Navbar Dropdown Implementation Plan

## Goal
Replace the individual "Admin", "Profile", and "Sign Out" links/buttons in the desktop navbar with a single responsive dropdown menu that displays the user's avatar and name.

## Requirements
1. **Dropdown Trigger**:
   - The trigger button will show the user's avatar and name.
   - It will replace the current separate "Admin", "Profile", and "Sign Out" elements in the UI.
   
2. **Dropdown Menu Items**:
   - **Dashboard**:
     - If the user's role is `admin`, the Dashboard link will redirect to `/admin`.
     - If the user's role is `user` (or normal user), the Dashboard link will redirect to `/dashboard`.
   - **Profile**: Redirects to `/profile`.
   - **Sign Out**: Triggers the logout action.

3. **Responsiveness**:
   - The dropdown and the entire navbar must remain responsive and look good on all devices.

## Proposed Changes
### `frontend/src/components/layout/navbar.tsx`
- Add state management (`useState`, `useRef`, and `useEffect` for clicking outside) to manage the dropdown's open/close state.
- **Remove**:
  - The standalone "Admin" link.
  - The standalone "Profile" link.
  - The standalone "Sign out" button.
- **Add**:
  - A relative container `div` for the dropdown.
  - A trigger button displaying the `avatarUrl` and `user.name` (like "Rony Rony" in the image).
  - An absolutely positioned `div` for the dropdown menu containing the "Dashboard", "Profile", and "Sign Out" items.
  - Conditional logic for the "Dashboard" link's `href` based on `user?.role`.
- **Mobile Menu**:
  - Update the mobile menu (the one triggered by the hamburger icon) to follow the same logic for the Dashboard route and ensure a clean, responsive layout.

## Next Steps
Once you approve this plan, I will implement the code changes in `navbar.tsx`.
